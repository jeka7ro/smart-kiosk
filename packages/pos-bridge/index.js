const { execSync } = require('child_process');
try {
  console.log('[INFO] Auto-sincronizare module POS Bridge (printer, etc.)...');
  execSync('curl -s -L -o brandLogos.js "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/brandLogos.js"');
  execSync('curl -s -L -o printer.js "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/printer.js"');
  execSync('curl -s -L -o rawprint.ps1 "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/rawprint.ps1"');
  execSync('curl -s -L -o start-windows.bat "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/start-windows.bat"');
  execSync('curl -s -L -o PrinterServiceDatecsFP950.js "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/PrinterServiceDatecsFP950.js"');
  execSync('curl -s -L -o VivaPosService.js "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/VivaPosService.js"');
  execSync('curl -s -L -o scan_port_pc.js "https://raw.githubusercontent.com/jeka7ro/smart-kiosk/main/packages/pos-bridge/scan_port_pc.js"');
} catch (e) {
  console.log('[WARN] Nu s-au putut sincroniza modulele:', e.message);
}

require('dotenv').config();
const { printTicket, getActualPrinterName } = require('./printer');
const { scanPortsPc } = require('./scan_port_pc');
const { io: ioClient } = require('socket.io-client');
const { SerialPort }   = require('serialport');
const fs               = require('fs');
const pathMod          = require('path');

const LOG_FILE = pathMod.join(__dirname, 'pos-bridge.log');
function log(msg) {
  const d = new Date();
  const ts = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
  const line = `[${ts}] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch (_) {}
}

// Curata fisierul de log la pornire
try { fs.writeFileSync(LOG_FILE, ''); } catch (_) {}

const RENDER_URL  = process.env.RENDER_URL  || 'https://smart-kiosk-ttut.onrender.com';
const COM_PORT    = process.env.COM_PORT    || 'auto';
const BAUD_RATE   = parseInt(process.env.BAUD_RATE || '9600');
const LOCATION_ID = process.env.LOCATION_ID || 'sm-brasov';
const BRIDGE_KEY  = process.env.BRIDGE_KEY  || 'pos-bridge-2024';

// Resolved location aliases (id + kioskUrl) — populated on startup
let LOCATION_ALIASES = [LOCATION_ID];
let detectedPrinterPort = process.env.PRINTER_PORT || '';
function isMyLocation(lid) {
  if (!lid) return true; // no filter = accept
  return LOCATION_ALIASES.includes(lid);
}
const POS_GATEWAY = process.env.POS_GATEWAY || 'raiffeisen'; // 'raiffeisen' sau 'viva_pos'
const VIVA_POS_IP = process.env.VIVA_POS_IP || '';
const VIVA_POS_PORT = parseInt(process.env.VIVA_POS_PORT || '8080', 10);

// Viva POS Service (doar dacă acest chioșc este configurat pe viva_pos)
let vivaPos = null;
if (POS_GATEWAY === 'viva_pos') {
  try {
    const VivaPosService = require('./VivaPosService');
    vivaPos = new VivaPosService(VIVA_POS_IP, VIVA_POS_PORT);
    log(`💳 Viva POS Service inițializat pentru terminal IP: ${VIVA_POS_IP}:${VIVA_POS_PORT}`);
  } catch (err) {
    log(`⚠️ Nu s-a putut inițializa VivaPosService: ${err.message}`);
  }
}

const DATECS_COM_PORT = process.env.DATECS_COM_PORT || '';
let datecsPrinter = null;
if (DATECS_COM_PORT) {
  try {
    const PrinterServiceDatecsFP950 = require('./PrinterServiceDatecsFP950');
    datecsPrinter = new PrinterServiceDatecsFP950(DATECS_COM_PORT, parseInt(process.env.DATECS_BAUD_RATE || '9600'));
    log(`🖨️  Imprimantă Datecs FP950 inițializată pe portul ${DATECS_COM_PORT}`);
  } catch (err) {
    log(`⚠️ Nu s-a putut încărca PrinterServiceDatecsFP950: ${err.message}`);
  }
}

const DLE = 0x10;
const STX = 0x02;
const ETX = 0x03;
const ACK = 0x06;
const NAK = 0x15;
const EOT = 0x04;
const ENQ = 0x05;
const FS  = 0x1C;
const CAN = 0x18; // ASCII Cancel / Abort for Verifone ECR

let globalPort = null;
let currentTransactionResolve = null;
let currentTransactionTimer = null;
let rxBuf = Buffer.alloc(0);
let state = 'IDLE';
let currentOperation = null; // 'LOGIN' | 'SALE' | 'SETTLEMENT'
let enqRetries = 0;
let pendingFrame = null;
let nextState = null;
let currentLabel = null;
let posLoggedIn = false;
let pendingPosAction = null;
let pendingPosResult = null;
let onLoginSuccess = null;

function resetPosLine(reason = 'Reset') {
  if (!globalPort || !globalPort.isOpen) return;
  try {
    log(`🧹 Resetare linie POS (${reason}): golire buffer și EOT...`);
    globalPort.write(Buffer.from([EOT]));
    if (typeof globalPort.flush === 'function') globalPort.flush();
  } catch (err) {
    log(`⚠️ Eroare resetPosLine: ${err.message}`);
  }
  rxBuf = Buffer.alloc(0);
}

function forceReopenPort(reason = 'Force Reset') {
  return new Promise((resolve) => {
    if (!globalPort) return resolve();
    log(`🔄 Re-ciclare port serial POS (${reason})...`);
    posLoggedIn = false;
    try {
      globalPort.close((err) => {
        setTimeout(() => {
          try {
            globalPort.open((openErr) => {
              if (openErr) {
                log(`⚠️ Eroare re-deschidere port: ${openErr.message}`);
              } else {
                log(`✅ Port serial re-deschis și reinițializat cu succes!`);
              }
              rxBuf = Buffer.alloc(0);
              resolve();
            });
          } catch (e) {
            resolve();
          }
        }, 300);
      });
    } catch (_) {
      resolve();
    }
  });
}

function calcLRC(cmdBytes) {
  let b = 0;
  for (const byte of cmdBytes) b ^= byte;
  return b;
}

function buildFrame(cmdBytes) {
  const lrc = calcLRC(cmdBytes);
  return Buffer.from([DLE, STX, ...cmdBytes, DLE, ETX, lrc]);
}

function extractFrame(buf, startOffset = 0) {
  for (let i = startOffset; i < buf.length - 1; i++) {
    if (buf[i] === DLE && buf[i + 1] === STX) {
      for (let j = i + 2; j < buf.length - 1; j++) {
        if (buf[j] === DLE && buf[j + 1] === ETX && buf.length > j + 2) {
          const cmdBytes = buf.subarray(i + 2, j);
          const lrcByte  = buf[j + 2];
          const frameEnd = j + 3;
          return { cmdBytes, lrcByte, frameEnd };
        }
      }
      break;
    }
  }
  return null;
}

async function resolvePosPort() {
  const ports = await SerialPort.list();
  log(`[Port Detective] Porturi seriale detectate pe PC (${ports.length}):`);
  ports.forEach(p => log(`  → ${p.path} | ${p.manufacturer || 'necunoscut'} | PnP: ${p.pnpId || '-'}`));

  // 1. Căutăm explicit adaptor USB-Serial (Prolific, FTDI, CH340, Silicon Labs, etc.)
  const usbSerial = ports.find(p => {
    const isCom = p.path.startsWith('COM') && !p.path.includes('BT');
    const isUsb = (p.pnpId && p.pnpId.toUpperCase().includes('USB')) ||
                  (p.manufacturer && /prolific|ftdi|ch340|silicon|wch/i.test(p.manufacturer));
    return isCom && isUsb;
  });

  // Dacă utilizatorul a configurat un port specific în .env
  if (COM_PORT && COM_PORT !== 'auto') {
    const configuredPort = ports.find(p => p.path.toUpperCase() === COM_PORT.toUpperCase());
    
    // Verificăm dacă portul din .env este cumva portul intern gol al plăcii de bază (ACPI PNP0501)
    const isInternalMotherboard = configuredPort && configuredPort.pnpId && configuredPort.pnpId.includes('PNP0501');
    if (isInternalMotherboard && usbSerial) {
      log(`⚠️ ATENȚIE: În .env este configurat ${COM_PORT}, dar acesta este portul intern ACPI al plăcii de bază (fără POS)!`);
      log(`🔄 Comut automat pe adaptorul USB-Serial conectat la POS: ${usbSerial.path} (${usbSerial.manufacturer || 'USB Serial'})`);
      return usbSerial.path;
    }

    if (configuredPort) {
      log(`✅ Folosesc portul COM configurat în .env: ${configuredPort.path}`);
      return configuredPort.path;
    }
    log(`⚠️ Portul configurat în .env (${COM_PORT}) nu a fost găsit printre porturile seriale active.`);
  }

  // 2. Dacă e 'auto' sau portul configurat nu există, alegem adaptorul USB-Serial
  if (usbSerial) {
    log(`✅ Adaptor USB-Serial POS detectat automat: ${usbSerial.path} (${usbSerial.manufacturer || 'USB Serial'})`);
    return usbSerial.path;
  }

  // 3. Ignorăm porturile ACPI de pe placa de bază dacă există orice alt port
  const nonAcpi = ports.find(p => p.path.startsWith('COM') && !p.path.includes('BT') && !(p.pnpId && p.pnpId.includes('PNP0501')));
  if (nonAcpi) return nonAcpi.path;

  // 4. Fallback ultim
  const firstCom = ports.find(p => p.path.startsWith('COM') && !p.path.includes('BT'));
  return firstCom ? firstCom.path : 'COM3';
}

const detectPosPort = resolvePosPort;

function ecrSend(frame, ns, label, timeoutMs = 1200, isRetryAfterHeal = false) {
  if (enqRetries === 0) {
    const hexStr = [...frame].map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
    log(`📤 Frame pregătit [${frame.length} bytes]: ${hexStr}`);
  }
  log(`📤 ENQ → (${label}) [Încercare ${enqRetries + 1}/3]${isRetryAfterHeal ? ' [după auto-heal]' : ''}`);
  
  globalPort.write(Buffer.from([ENQ]));
  state = `WAIT_ENQ_ACK__${ns}`;
  currentOperation = ns;
  pendingFrame = frame;
  nextState    = ns;
  currentLabel = label;
  
  clearTimeout(currentTransactionTimer);
  currentTransactionTimer = setTimeout(() => {
    enqRetries++;
    if (enqRetries < 3) {
      log(`⚠️ Timeout ACK la ENQ (${label}). Trimit ENQ reîncercare (${enqRetries + 1}/3)...`);
      setTimeout(() => {
        ecrSend(frame, ns, label, timeoutMs, isRetryAfterHeal);
      }, 300);
    } else {
      enqRetries = 0;
      
      // AUTO-HEAL: Dacă POS-ul nu răspunde la 3x ENQ, nu dăm direct eroare!
      // Resetăm hardware semnalele seriale DTR/RTS (300ms) pentru a trezi/debloca POS-ul și reîncercăm tranzacția!
      if (!isRetryAfterHeal) {
        log(`🔄 POS tăcut la 3x ENQ (${label}). Declanșez AUTO-HEAL hardware pe portul serial...`);
        globalPort.write(Buffer.from([EOT]));
        forceReopenPort(`Auto-Heal 3x ENQ ${label}`).then(async () => {
          state = 'IDLE';
          log(`🚀 Port serial resetat și sincronizat curat. Retrimit comanda (${label}) pe loc...`);
          setTimeout(() => {
            ecrSend(frame, ns, label, timeoutMs, true);
          }, 300);
        }).catch(() => {
          state = 'IDLE';
          if (currentTransactionResolve) {
            currentTransactionResolve({ success: false, reason: 'POS-ul nu răspunde după resetare.', code: 'DECLINED' });
          }
        });
        return;
      }

      // Doar dacă eșuează chiar și după auto-recuperare hardware
      log(`❌ Eșuat definitiv 3 încercări ENQ (${label}) după auto-heal. Reciclez conexiunea...`);
      globalPort.write(Buffer.from([EOT]));
      forceReopenPort(`Eșuat 3x ENQ ${label}`).finally(() => {
        state = 'IDLE';
        if (currentTransactionResolve) {
          currentTransactionResolve({ success: false, reason: 'POS-ul nu răspunde (Timeout).', code: 'DECLINED' });
        }
      });
    }
  }, timeoutMs);
}

function ensurePosLogin() {
  return new Promise((resolve) => {
    if (!globalPort || !globalPort.isOpen) return resolve(false);
    if (posLoggedIn) return resolve(true);
    log('🔐 Inițiez LOGIN ECR pe terminalul POS (Printec v3.9.3)...');
    onLoginSuccess = () => {
      resolve(true);
    };
    ecrSend(buildFrame([0x06, 0x00, 0x00]), 'LOGIN', 'LOGIN', 5000);
  });
}

function processPrintecPayment(amount, onStatus) {
  return new Promise((resolve) => {
    if (!globalPort || !globalPort.isOpen) {
       return resolve({ success: false, reason: 'Portul POS nu este deschis', code: 'DECLINED' });
    }
    if (state !== 'IDLE') {
       log(`⚠️ Stare anterioară (${state}) la inițiere plată. Reciclez starea în IDLE și curăț bufferul...`);
       state = 'IDLE';
       if (globalPort && typeof globalPort.flush === 'function') {
         try { globalPort.flush(); } catch (_) {}
       }
    }

    rxBuf = Buffer.alloc(0);
    enqRetries = 0;
    
    currentTransactionResolve = (res) => {
      clearTimeout(currentTransactionTimer);
      globalPort.drain(() => {
        state = 'IDLE';
        currentTransactionResolve = null;
        resolve(res);
      });
    };

    const succeed = (result) => {
      if (currentTransactionResolve) currentTransactionResolve(result);
    };

    const fail = (msg) => {
      if (currentTransactionResolve) {
        clearTimeout(currentTransactionTimer);
        globalPort.drain(() => {
          state = 'IDLE';
          currentTransactionResolve({ success: false, reason: msg, code: 'DECLINED' });
          currentTransactionResolve = null;
        });
      }
    };

    const cents   = Math.round(amount * 100);
    const amtStr  = String(cents).padStart(12, '0');
    // SALE format Printec v3.9.3: 06 01 15 + amount(12) + '000' + '000000'
    const saleCmd = [0x06, 0x01, 0x15, ...Buffer.from(amtStr + '000' + '000000', 'ascii')];
    const SALE_FRAME = buildFrame(saleCmd);

    log(`💳 Sumă de plată: ${amount.toFixed(2)} RON (${cents} bani)`);
    rxBuf = Buffer.alloc(0);
    
    globalPort.currentStatusCallback = onStatus;
    globalPort.currentSucceed = succeed;
    globalPort.currentFail = fail;
    globalPort.currentSALE_FRAME = SALE_FRAME;
    globalPort.currentOpFrame = SALE_FRAME;
    globalPort.currentOpName = 'SALE';

    const startSale = () => {
      log('📤 Trimit comanda SALE către POS...');
      ecrSend(SALE_FRAME, 'SALE', 'SALE', 1200);
    };

    if (posLoggedIn) {
      startSale();
    } else {
      log('🔐 POS neautentificat — execut LOGIN înainte de SALE...');
      onLoginSuccess = () => {
        setTimeout(startSale, 300);
      };
      ecrSend(buildFrame([0x06, 0x00, 0x00]), 'LOGIN', 'LOGIN', 5000);
    }
  });
}

async function start() {
  let portPath = null;
  if (POS_GATEWAY === 'raiffeisen') {
    portPath = await resolvePosPort();
  }

  const socket = ioClient(RENDER_URL, { auth: { bridgeKey: BRIDGE_KEY, locationId: LOCATION_ID } });

  log('════════════════════════════════════════════');
  log(`Bridge v7.8 (${POS_GATEWAY === 'viva_pos' ? 'Viva Wallet PAX A80 — IP' : 'Raiffeisen Printec ECR — Serial'})`);
  log(`Gateway:   ${POS_GATEWAY.toUpperCase()}`);
  if (POS_GATEWAY === 'raiffeisen') {
    log(`Port config: ${COM_PORT}`);
    log(`COM Port:    ${portPath} @ ${BAUD_RATE} baud (8-N-1)`);
  } else {
    log(`Terminal IP: ${VIVA_POS_IP}:${VIVA_POS_PORT}`);
  }
  log(`Render:      ${RENDER_URL}`);
  log(`Locație:     ${LOCATION_ID}`);
  log('════════════════════════════════════════════');

  socket.on('connect', async () => {
    log(`✅ Conectat la Render (${socket.id})`);
    socket.emit('pos_bridge_register', { locationId: LOCATION_ID, port: portPath || `VIVA_${VIVA_POS_IP}` });

    // ─── Port/Printer Scan ───────────────────────────────────────────────────
    try {
      const scanData = await scanPortsPc();
      const actualPrinter = typeof getActualPrinterName === 'function' ? getActualPrinterName() : (process.env.PRINTER_NAME || 'EPSON TM-T20III Receipt');
      const matchedPrinter = scanData.printers.find(p => (p.name || p.Name) === actualPrinter || (p.name || p.Name || '').toLowerCase().includes('epson') || (p.name || p.Name || '').toLowerCase().includes('receipt'));
      if (matchedPrinter) {
        detectedPrinterPort = matchedPrinter.port || matchedPrinter.PortName || '';
      }
      socket.emit('port_scan', {
        locationId: LOCATION_ID,
        locationName: LOCATION_ID,
        posPort: portPath || `VIVA_${VIVA_POS_IP}`,
        posGateway: POS_GATEWAY,
        printerName: actualPrinter,
        baudRate: BAUD_RATE,
        ...scanData,
      });
      log(`📡 Scan PC trimis la server (POS: ${portPath}, Imprimantă: "${actualPrinter}", Port imprimantă: ${detectedPrinterPort || '?'})`);
    } catch (scanErr) {
      log(`⚠ Eroare la scanare PC: ${scanErr.message}`);
    }

    // Resolve location aliases (id + kioskUrl) so bridge matches both
    try {
      const https = require('https');
      const apiKey = process.env.VITE_API_KEY || 'sk-live-2024-secure';
      const url = `${RENDER_URL}/api/locations/${LOCATION_ID}`;
      log(`📡 Rezolv aliases: GET ${url}`);
      https.get(url, { headers: { 'x-api-key': apiKey } }, (res) => {
        log(`📡 Răspuns status: ${res.statusCode}`);
        let body = '';
        res.on('data', (chunk) => body += chunk);
        res.on('end', () => {
          try {
            const locData = JSON.parse(body);
            if (locData.error) {
              log(`⚠ Server a răspuns cu eroare: ${locData.error}`);
              return;
            }
            const aliases = new Set([LOCATION_ID]);
            if (locData.id) aliases.add(locData.id);
            if (locData.kioskUrl) aliases.add(locData.kioskUrl);
            if (Array.isArray(locData.aliases)) {
              locData.aliases.forEach(a => aliases.add(a));
            }
            LOCATION_ALIASES = [...aliases];
            log(`📍 Locație rezolvată: aliases=[${LOCATION_ALIASES.join(', ')}]`);
          } catch (e) {
            log(`⚠ Nu am putut parsa răspuns locație: ${e.message} | body: ${body.substring(0, 100)}`);
          }
        });
      }).on('error', (e) => {
        log(`⚠ Eroare HTTP aliases locație: ${e.message}`);
      });
    } catch (e) {
      log(`⚠ Eroare aliases locație: ${e.message}`);
    }
  });

  socket.on('disconnect', (reason) => {
    log(`⚠ Deconectat: ${reason}`);
  });

  if (POS_GATEWAY === 'raiffeisen') {
    globalPort = new SerialPort({
      path: portPath, baudRate: BAUD_RATE,
      dataBits: 8, parity: 'none', stopBits: 1, autoOpen: true,
    });

    globalPort.on('open', () => {
      log(`✅ Port serial POS deschis: ${portPath} @ ${BAUD_RATE}`);
      setTimeout(() => {
        ensurePosLogin().catch(e => log(`⚠️ Eroare login inițial POS: ${e.message}`));
      }, 500);
    });

    globalPort.on('error', err => {
      log(`❌ Eroare port serial POS: ${err.message}`);
      posLoggedIn = false;
      if (currentTransactionResolve) {
        currentTransactionResolve({ success: false, reason: err.message, code: 'DECLINED' });
      }
    });

    globalPort.on('data', (chunk) => {
      const hexStr = [...chunk].map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
      log(`📥 RAW RX [${chunk.length} bytes]: ${hexStr}`);
      rxBuf = Buffer.concat([rxBuf, chunk]);

      const succeed = globalPort.currentSucceed;
      const fail = globalPort.currentFail;
      const onStatus = globalPort.currentStatusCallback;

      while (rxBuf.length > 0) {
        const b = rxBuf[0];

        // 1. ACK la ENQ-ul nostru (când ECR este inițiatorul)
        if (b === ACK && state.startsWith('WAIT_ENQ_ACK__')) {
          rxBuf = rxBuf.subarray(1);
          clearTimeout(currentTransactionTimer);
          enqRetries = 0;
          
          log(`✅ ACK ← POS la ENQ (${currentLabel}). Trimit frame...`);
          globalPort.write(pendingFrame);
          state = `WAIT_FRAME_ACK__${nextState}`;
          currentTransactionTimer = setTimeout(() => fail(`Timeout ACK la frame (${currentLabel})`), 3000);
          break;
        }

        // 2. ACK la Frame-ul nostru (când ECR a trimis un cadru)
        if (b === ACK && state.startsWith('WAIT_FRAME_ACK__')) {
          rxBuf = rxBuf.subarray(1);
          clearTimeout(currentTransactionTimer);
          const ns = state.replace('WAIT_FRAME_ACK__', '');

          // Conform Cap. 4 & Anexa A: ECR trimite EOT pentru a marca finalul transmiterii cadrului ECR
          log(`✅ Frame acceptat de POS (${ns}) → Trimit EOT conform protocol`);
          globalPort.write(Buffer.from([EOT]));

          if (ns === 'LOGIN') {
            state = 'WAIT_POS_ENQ__LOGIN_RESP';
            currentTransactionTimer = setTimeout(() => fail('Timeout ENQ răspuns LOGIN'), 5000);
          } else if (ns === 'SALE') {
            log('⏳ Aștept confirmarea de acceptare a vânzării de la POS (80 00 00)...');
            state = 'WAIT_POS_ENQ__RESULT';
            currentTransactionTimer = setTimeout(() => fail('Timeout răspuns inițial POS după SALE'), 10000);
          } else if (ns === 'SETTLEMENT') {
            log('⏳ Aștept răspuns Settlement de la POS...');
            state = 'WAIT_POS_ENQ__SETTLEMENT_RESP';
            currentTransactionTimer = setTimeout(() => fail('Timeout settlement'), 120000);
          }
          break;
        }

        // 3. NAK primit la cadrul nostru
        if (b === NAK) {
          rxBuf = rxBuf.subarray(1);
          log('⚠️ NAK primit de la POS! (Cadru corupt sau LRC invalid)');
          break;
        }

        // 4. EOT recepționat de la POS (POS finalizează schimbul de date inițiat de el)
        // Conform Cap. 4 & Anexa A: La cadrele inițiate de POS, EOT este trimis exclusiv de POS!
        if (b === EOT) {
          rxBuf = rxBuf.subarray(1);
          clearTimeout(currentTransactionTimer);
          log(`📥 EOT ← POS (stare=${state}, acțiune=${pendingPosAction || '-'})`);

          const action = pendingPosAction;
          pendingPosAction = null;

          if (action === 'LOGIN_DONE') {
            posLoggedIn = true;
            state = 'IDLE';
            log('✅ LOGIN finalizat complet cu POS-ul.');
            if (typeof onLoginSuccess === 'function') {
              const cb = onLoginSuccess;
              onLoginSuccess = null;
              cb();
            }
          } else if (action === 'AWAIT_CARD') {
            // Cadrul 80 00 00 a fost confirmat cu EOT de POS -> POS așteaptă cardul (până la 2 minute)
            state = 'WAIT_POS_ENQ__RESULT';
            currentTransactionTimer = setTimeout(() => fail('Timp expirat citire card (2 minute)'), 120000);
          } else if (action === 'CONTINUE_RESULT') {
            state = 'WAIT_POS_ENQ__RESULT';
            currentTransactionTimer = setTimeout(() => fail('Timeout rezultat tranzacție'), 120000);
          } else if (action === 'TX_FINISHED' || action === 'TX_REFUSED') {
            state = 'IDLE';
            const res = pendingPosResult;
            pendingPosResult = null;
            if (succeed && res) succeed(res);
          } else if (action === 'SETTLEMENT_DONE') {
            state = 'IDLE';
            const res = pendingPosResult;
            pendingPosResult = null;
            if (succeed && res) succeed(res);
          } else {
            state = 'IDLE';
          }
          break;
        }

        // 5. ENQ de la POS (POS dorește să transmită un cadru către ECR)
        if (b === ENQ) {
          rxBuf = rxBuf.subarray(1);
          clearTimeout(currentTransactionTimer);
          log(`📥 ENQ ← POS (stare=${state}) → Trimit ACK`);
          // Conform Cap. 4 & Anexa A: ECR confirmă ENQ-ul cu ACK
          globalPort.write(Buffer.from([ACK]));

          // Trecem în așteptarea cadrului DLE STX...
          state = 'WAIT_POS_FRAME';
          currentTransactionTimer = setTimeout(() => fail('Timeout cadru de la POS după ENQ'), 5000);
          break;
        }

        // 6. Cadru complet de la POS (DLE STX ... DLE ETX LRC)
        if (b === DLE && rxBuf.length >= 2 && rxBuf[1] === STX) {
          const extracted = extractFrame(rxBuf);
          if (!extracted) break; // cadru incomplet în buffer, așteptăm restul octeților

          const { cmdBytes, lrcByte, frameEnd } = extracted;
          rxBuf = rxBuf.subarray(frameEnd);
          clearTimeout(currentTransactionTimer);

          const calcedLRC = calcLRC(cmdBytes);
          if (lrcByte !== calcedLRC) {
            log(`⚠️ LRC mismatch de la POS (calculat: 0x${calcedLRC.toString(16)}, primit: 0x${lrcByte.toString(16)}) → Trimit NAK`);
            globalPort.write(Buffer.from([NAK]));
            break;
          }

          // Conform Cap. 4 & Anexa A: La primirea corectă a cadrului, ECR trimite strict ACK (NU EOT!)
          // EOT-ul va fi trimis exclusiv de către POS conform protocolului.
          globalPort.write(Buffer.from([ACK]));

          const klasse = cmdBytes[0];
          const instr  = cmdBytes[1];
          const dlng   = cmdBytes[2];
          const data   = cmdBytes.subarray(3);

          log(`📥 Cadru valid de la POS: klasse=0x${klasse.toString(16).toUpperCase()} instr=0x${instr.toString(16).toUpperCase()} dlng=${dlng}`);

          // Cazul A: Răspuns LOGIN (80 00 00 sau 84 XX 00)
          if ((klasse === 0x80 || klasse === 0x84) && currentOperation === 'LOGIN') {
            const ok = (klasse === 0x80) || (klasse === 0x84 && instr === 0x00);
            if (ok) {
              log('✅ Răspuns LOGIN pozitiv de la POS. Aștept EOT de la terminal...');
              pendingPosAction = 'LOGIN_DONE';
              state = 'WAIT_POS_EOT';
              currentTransactionTimer = setTimeout(() => fail('Timeout EOT după LOGIN response'), 3000);
            } else {
              log(`❌ LOGIN refuzat de POS (cod eroare: 0x${instr.toString(16)})`);
              fail(`LOGIN refuzat de POS (APRW=0x${instr.toString(16)})`);
            }
            break;
          }

          // Cazul B: Confirmare acceptare SALE (80 00 00 / 84 00 00) — ANEXA A, PAG. 18
          if ((klasse === 0x80 || klasse === 0x84) && currentOperation === 'SALE') {
            const ok = (klasse === 0x80) || (klasse === 0x84 && instr === 0x00);
            if (ok) {
              log('✅ SALE acceptat de POS! Terminal activat — apropiați cardul. Aștept EOT de la terminal...');
              onStatus && onStatus('Terminal activat — apropiați cardul');
              pendingPosAction = 'AWAIT_CARD';
              state = 'WAIT_POS_EOT';
              currentTransactionTimer = setTimeout(() => fail('Timeout EOT după acceptare SALE'), 3000);
            } else {
              log(`❌ SALE refuzat de POS (APRW=0x${instr.toString(16)})`);
              if (instr === 0x02) {
                // ECR has not executed login
                posLoggedIn = false;
              }
              fail(`Comandă vânzare refuzată de POS (APRW=0x${instr.toString(16)})`);
            }
            break;
          }

          // Cazul C: Confirmare SETTLEMENT (80 00 00)
          if ((klasse === 0x80 || klasse === 0x84) && currentOperation === 'SETTLEMENT') {
            log('✅ SETTLEMENT acceptat de POS. Aștept EOT...');
            pendingPosAction = 'SETTLEMENT_DONE';
            pendingPosResult = { success: true, reason: 'Settlement OK' };
            state = 'WAIT_POS_EOT';
            currentTransactionTimer = setTimeout(() => fail('Timeout EOT după settlement'), 5000);
            break;
          }

          // Cazul D: PIN Entry (05 01 00) — PAG. 13
          if (klasse === 0x05 && instr === 0x01) {
            log('📥 PIN Entry — clientul introduce codul PIN pe POS');
            onStatus && onStatus('Introduceți codul PIN pe terminal');
            pendingPosAction = 'CONTINUE_RESULT';
            state = 'WAIT_POS_EOT';
            currentTransactionTimer = setTimeout(() => fail('Timeout EOT după PIN Entry'), 3000);
            break;
          }

          // Cazul E: Begin Auth (05 02 00) — PAG. 14
          if (klasse === 0x05 && instr === 0x02) {
            log('📥 Begin Auth — POS comunică cu serverul bancar');
            onStatus && onStatus('Comunicare cu banca...');
            pendingPosAction = 'CONTINUE_RESULT';
            state = 'WAIT_POS_EOT';
            currentTransactionTimer = setTimeout(() => fail('Timeout EOT după Begin Auth'), 3000);
            break;
          }

          // Cazul F: Authorization End (06 0F XX) — REZULTAT FINAL TRANZACȚIE (PAG. 13 & ANEXA B)
          if (klasse === 0x06 && instr === 0x0F) {
            const payload = data;
            const refNum   = payload.subarray(0, 12).toString('ascii').trim();
            const termId   = payload.subarray(12, 20).toString('ascii').trim();
            const txDate   = payload.subarray(20, 32).toString('ascii').trim();
            const amtField = payload.subarray(32, 44).toString('ascii').trim();
            const currency = payload.subarray(44, 47).toString('ascii').trim();
            const authCode = payload.subarray(47, 53).toString('ascii').trim();
            const respCode = payload.subarray(53, 57).toString('ascii').trim();

            const varStr    = payload.subarray(57).toString('ascii');
            const varFields = varStr.split(String.fromCharCode(FS));
            const cardNo    = (varFields[1] || '').trim();
            
            let receiptNo = (varFields[3] || '').trim();
            if (receiptNo.length >= 7) receiptNo = receiptNo.slice(1);

            const approved = (respCode === '0000');
            
            log(`📥 Rezultat final: Code=${respCode} (${approved ? 'APROBAT' : 'RESPINS'}) Auth=${authCode} Card=${cardNo} Ref=${refNum} Receipt=${receiptNo}`);
            
            pendingPosAction = 'TX_FINISHED';
            pendingPosResult = {
              success: approved,
              code: respCode,
              authCode,
              refNum,
              txDate,
              amount: amtField,
              currency,
              termId,
              cardNo,
              receiptNo,
              extraFields: varFields,
              raw: payload.toString('hex'),
            };
            state = 'WAIT_POS_EOT';
            currentTransactionTimer = setTimeout(() => fail('Timeout EOT după rezultat final'), 3000);
            break;
          }

          // Cazul G: Refusal de la POS (06 1E 01 [code]) — ANEXA A, PAG. 18 (ex: 06 1E 01 A0)
          if (klasse === 0x06 && instr === 0x1E) {
            const errCode = data[0];
            const hexCode = '0x' + errCode.toString(16).toUpperCase();
            log(`❌ Refuz / Anulare de la POS, cod=${hexCode}`);
            
            let explicitReason = `Tranzacție refuzată de terminal (Cod: ${hexCode})`;
            if (errCode === 0xA0) explicitReason = 'Tranzacție refuzată sau anulată de client de pe POS.';

            pendingPosAction = 'TX_REFUSED';
            pendingPosResult = {
              success: false,
              code: errCode.toString(16).toUpperCase(),
              authCode: '',
              refNum: '',
              reason: explicitReason
            };
            state = 'WAIT_POS_EOT';
            currentTransactionTimer = setTimeout(() => fail('Timeout EOT după refuz POS'), 3000);
            break;
          }

          // Cadrul neprevăzut
          log(`⚠️ Cadru neprevăzut de la POS: klasse=0x${klasse.toString(16)} instr=0x${instr.toString(16)}`);
          pendingPosAction = 'CONTINUE_RESULT';
          state = 'WAIT_POS_EOT';
          break;
        }

        if (b === DLE) break;

        rxBuf = rxBuf.subarray(1);
      }
    });
  } // sfarsit bloc raiffeisen serial

  let paymentInProgress = false;

  socket.on('pos_payment_request', async (data) => {
    const { orderId, amount, locationId: lid } = data;
    
    if (!isMyLocation(lid)) return;

    if (paymentInProgress) {
      log(`⚠️ SKIP: o plată e deja în curs`);
      socket.emit('pos_payment_result', { orderId, paid: false, error: 'Altă plată în curs' });
      return;
    }

    paymentInProgress = true;
    log(`💳 ==== CERERE PLATĂ ==== orderId: ${orderId} | amount: ${amount} RON | gateway: ${POS_GATEWAY}`);
    
    socket.emit('pos_bridge_status', { orderId, message: 'Inițiez plata...' });

    try {
      let res;
      if (POS_GATEWAY === 'viva_pos') {
        if (!vivaPos) {
          throw new Error('Modulul Viva POS nu este configurat sau VIVA_POS_IP lipsește.');
        }
        socket.emit('pos_bridge_status', { orderId, message: 'Apropiați sau introduceți cardul în terminalul Viva...' });
        res = await vivaPos.processPayment(amount);
      } else {
        res = await processPrintecPayment(amount, (msg) => {
          log(`STATUS: ${msg}`);
          socket.emit('pos_bridge_status', { orderId, message: msg });
        });
      }
      
      log(`✅ REZULTAT: ${res.success ? 'APROBAT' : 'REFUZAT'} auth=${res.authCode || ''}`);
      
      socket.emit('pos_payment_result', { 
        orderId, 
        locationId: lid || LOCATION_ID,
        amount,
        paid: res.success, 
        authCode: res.authCode,
        refNum: res.refNum,
        cardNo: res.cardNo,
        receiptNo: res.receiptNo,
        txDate: res.txDate,
        code: res.code || (res.success ? '0000' : 'DECLINED'),
        raw: { data: res.raw || '', extraFields: res.extraFields || [] },
        error: res.reason || null
      });
    } catch (err) {
      log(`❌ EROARE: ${err.message}`);
      socket.emit('pos_payment_result', { orderId, paid: false, error: err.message });
    } finally {
      paymentInProgress = false;
    }
  });

  socket.on('cancel_pos_payment', async (data) => {
    const { locationId: lid } = data || {};
    if (!isMyLocation(lid)) return;
    
    log('🛑 CANCEL payment solicitat din Kiosk (timeout / anulare client)!');
    if (paymentInProgress) {
      paymentInProgress = false;
      if (globalPort && globalPort.currentFail) {
        globalPort.currentFail('Anulat de client din interfața Kiosk');
      }
    }

    // Întotdeauna când Kiosk trimite cancel, asigurăm deblocarea hardware a ecranului POS
    if (globalPort && globalPort.isOpen) {
      log('🔄 Resetare hardware port serial pentru eliberare garantată ecran POS...');
      try {
        await forceReopenPort('Anulare Kiosk');
        await ensurePosLogin();
      } catch (e) {
        log(`⚠️ Eroare resetare port după cancel: ${e.message}`);
      }
    }
  });

  const recentPrintedOrders = new Map();

  socket.on('print_ticket', async (payload) => {
    const order = payload && payload.order ? payload.order : payload;
    if (order && (isMyLocation(order.locationId))) {
      const orderKey = `${order._id || order.id || ''}_${order.orderNumber || ''}`;
      const now = Date.now();
      if (orderKey && recentPrintedOrders.has(orderKey) && (now - recentPrintedOrders.get(orderKey) < 60000)) {
        log(`ℹ️ Comanda #${order.orderNumber} a fost deja tipărită (duplicat ignorat).`);
        return;
      }
      if (orderKey) {
        recentPrintedOrders.set(orderKey, now);
        for (const [k, time] of recentPrintedOrders.entries()) {
          if (now - time > 300000) recentPrintedOrders.delete(k);
        }
      }

      log(`🖨️  Cerere printare bon pentru comanda #${order.orderNumber}`);
      let printResult = null;
      if (datecsPrinter) {
        try {
          await datecsPrinter.printOrder(order);
          log(`✅ Bon comanda #${order.orderNumber} tipărit pe Datecs FP950`);
          printResult = { status: 'success', method: 'datecs_fp950', printerName: 'Datecs FP950' };
        } catch (err) {
          log(`❌ Eroare printare Datecs FP950: ${err.message}`);
          printResult = { status: 'error', method: 'datecs_fp950', printerName: 'Datecs FP950', error: err.message };
        }
      } else {
        printResult = await printTicket(order);
      }

      // Emit printer log to server
      if (printResult) {
        socket.emit('printer_log', {
          locationId: LOCATION_ID,
          locationName: order.locationName || LOCATION_ID,
          brand: order.brand || (order.items && order.items[0] && order.items[0].brandId) || '',
          kioskId: order.kioskId || '',
          orderId: order._id || order.id || '',
          orderNumber: order.orderNumber || '',
          status: printResult.status,
          error: printResult.error || null,
          printerName: printResult.printerName || '',
          port: detectedPrinterPort || '',
          method: printResult.method || '',
          itemsCount: order.items ? order.items.length : 0,
          totalAmount: order.totalAmount || 0,
          paymentMethod: order.paymentMethod || '',
          receiptContent: printResult.receiptContent || null,
        });
      }
    }
  });

  async function triggerSettlement(lid) {
    if (!isMyLocation(lid)) return;

    if (paymentInProgress || state !== 'IDLE') {
      log('⚠️ Nu pot face Settlement, altă operație în curs');
      socket.emit('pos_settlement_result', { success: false, error: 'Altă operație în curs' });
      return;
    }

    log('🔄 ==== SETTLEMENT / ÎNCHIDERE DE ZI ====');
    paymentInProgress = true;

    try {
      const result = await new Promise((resolve) => {
        rxBuf = Buffer.alloc(0);
        enqRetries = 0;

        currentTransactionResolve = (res) => {
          clearTimeout(currentTransactionTimer);
          globalPort.drain(() => {
            state = 'IDLE';
            currentTransactionResolve = null;
            resolve(res);
          });
        };

        globalPort.currentSucceed = (r) => { if (currentTransactionResolve) currentTransactionResolve(r); };
        globalPort.currentFail = (msg) => {
          if (currentTransactionResolve) {
            clearTimeout(currentTransactionTimer);
            resetPosLine('Settlement eșuat');
            globalPort.drain(() => {
              state = 'IDLE';
              currentTransactionResolve({ success: false, reason: msg, code: 'DECLINED' });
              currentTransactionResolve = null;
            });
          }
        };
        globalPort.currentStatusCallback = null;

        const settlementCmd = [0x06, 0x50, 0x00];
        const SETTLE_FRAME = buildFrame(settlementCmd);

        const startSettle = () => {
          log('📤 Trimit comanda SETTLEMENT către POS...');
          ecrSend(SETTLE_FRAME, 'SETTLEMENT', 'SETTLEMENT', 120000);
        };

        if (posLoggedIn) {
          startSettle();
        } else {
          log('🔐 POS neautentificat — execut LOGIN înainte de Settlement...');
          onLoginSuccess = () => {
            setTimeout(startSettle, 300);
          };
          ecrSend(buildFrame([0x06, 0x00, 0x00]), 'LOGIN', 'LOGIN', 5000);
        }
      });

      log(`🔄 Settlement result: ${JSON.stringify(result)}`);
      socket.emit('pos_settlement_result', { success: true, result });
    } catch (err) {
      log(`❌ Settlement error: ${err.message}`);
      socket.emit('pos_settlement_result', { success: false, error: err.message });
    } finally {
      paymentInProgress = false;
    }
  }

  socket.on('pos_settlement', (data) => triggerSettlement(data?.locationId));
}

start().catch(err => {
  log(`❌ EROARE FATALĂ: ${err.message}`);
  process.exit(1);
});
