/**
 * Printec ECR v3.9.3 — VeriFone V200t Serial Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Implementare completă a protocolului Printec ECR v3.9.3 pentru comunicare
 * cu POS VeriFone V200t prin RS-232 (DB9 serial / adaptor USB-Serial FTDI).
 *
 * Parametri seriali (Appendix C din specificație):
 *   Speed:        9600 bps
 *   Data bits:    8
 *   Parity:       None
 *   Stop bits:    1
 *   Flow control: None
 *
 * Frame format:
 *   DLE(0x10) STX(0x02) <COMMAND BYTES> DLE(0x10) ETX(0x03) LRC
 *   LRC = XOR doar pe COMMAND BYTES (fără delimitatori)
 *
 * Flow tranzacție SALE:
 *   1. ECR→POS: LOGIN (06 00 00)
 *   2. POS→ECR: LOGIN OK (80 00 00)
 *   3. ECR→POS: SALE (06 01 15 <amount12> <artcode3> <qty6>)
 *   4. POS→ECR: SALE ACK (80 00 00) — terminal activat, aşteaptă card
 *   5. POS→ECR: [opțional] PIN Entry (05 01 00)
 *   6. POS→ECR: [opțional] Begin Auth (05 02 00)
 *   7. POS→ECR: Authorization End (06 0F XX <result>) sau Refusal (06 1E 01 code)
 *
 * Variabile .env:
 *   VERIFONE_SERIAL_PORT=/dev/cu.usbserial-FTF2NAV8
 *   VERIFONE_BAUD_RATE=9600   (opțional, default 9600)
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { SerialPort } = require('serialport');

// Control characters
const DLE = 0x10;
const STX = 0x02;
const ETX = 0x03;
const ACK = 0x06;
const NAK = 0x15;
const EOT = 0x04;
const ENQ = 0x05;
const FS  = 0x1C;

class VerifoneSerialService {
  /**
   * @param {string} portPath  - ex: '/dev/cu.usbserial-FTF2NAV8' sau 'COM3'
   * @param {number} [baudRate=9600]
   */
  constructor(portPath, baudRate = 9600) {
    this.portPath = portPath;
    this.baudRate = baudRate;
  }

  // ─── Frame Helpers ────────────────────────────────────────────────────────

  /** LRC = XOR al tuturor octeților din command (fără DLE STX / DLE ETX) */
  _calcLRC(cmdBytes) {
    let b = 0;
    for (const byte of cmdBytes) b ^= byte;
    return b;
  }

  /**
   * Construiește un frame Printec complet:
   * DLE STX <cmdBytes> DLE ETX LRC
   * @param {number[]} cmdBytes
   */
  _buildFrame(cmdBytes) {
    const lrc = this._calcLRC(cmdBytes);
    return Buffer.from([DLE, STX, ...cmdBytes, DLE, ETX, lrc]);
  }

  /**
   * Încearcă să extragă un frame complet DLE STX...DLE ETX din buffer.
   * @returns {{ cmdBytes: Buffer, frameEnd: number } | null}
   */
  _extractFrame(buf, startOffset = 0) {
    // Caută DLE STX
    for (let i = startOffset; i < buf.length - 1; i++) {
      if (buf[i] === DLE && buf[i + 1] === STX) {
        // Caută DLE ETX după start
        for (let j = i + 2; j < buf.length - 1; j++) {
          if (buf[j] === DLE && buf[j + 1] === ETX && buf.length > j + 2) {
            const cmdBytes = buf.subarray(i + 2, j);
            const lrcByte  = buf[j + 2];
            const frameEnd = j + 3; // octet după LRC
            return { cmdBytes, lrcByte, frameEnd };
          }
        }
        break; // frame incomplet — aşteptăm mai mult
      }
    }
    return null;
  }

  // ─── Payment Flow ─────────────────────────────────────────────────────────

  /**
   * Procesează o plată prin POS VeriFone V200t.
   *
   * @param {number} amount - suma în RON (ex: 25.50)
   * @param {object} [opts]
   * @param {function} [opts.onStatus] - callback(msg: string) pentru status intermediar
   * @returns {Promise<{success: boolean, code: string, authCode: string, refNum: string, receiptNo: string, raw: string}>}
   */
  async processPayment(amount, opts = {}) {
    if (!amount || amount <= 0) throw new Error('Sumă invalidă pentru plată');

    const onStatus = opts.onStatus || (() => {});

    // ── Frame-uri ──────────────────────────────────────────────────────────
    const LOGIN_FRAME = this._buildFrame([0x06, 0x00, 0x00]);

    const cents   = Math.round(amount * 100);
    const amtStr  = String(cents).padStart(12, '0');
    // SALE: 06 01 15 + amount(12) + '000'(3) + '000000'(6)  → DLNG=0x15=21
    const saleCmd = [0x06, 0x01, 0x15, ...Buffer.from(amtStr + '000' + '000000', 'ascii')];
    const SALE_FRAME = this._buildFrame(saleCmd);

    return new Promise((resolve, reject) => {
      let port;
      let rxBuf    = Buffer.alloc(0);
      let state    = 'IDLE';
      let finished = false;
      let stateTimer;

      const log = (msg) => console.log(`[VerifoneSerial] ${msg}`);

      const cleanup = () => {
        clearTimeout(stateTimer);
        try { if (port && port.isOpen) port.close(); } catch (_) {}
      };

      const fail = (msg) => {
        if (finished) return;
        finished = true;
        cleanup();
        reject(new Error(msg));
      };

      const succeed = (result) => {
        if (finished) return;
        finished = true;
        cleanup();
        resolve(result);
      };

      const setState = (s) => { state = s; };

      const armTimeout = (msg, ms) => {
        clearTimeout(stateTimer);
        stateTimer = setTimeout(() => fail(`Timeout: ${msg}`), ms);
      };

      // ── Deschidere port ───────────────────────────────────────────────────
      try {
        port = new SerialPort({
          path: this.portPath,
          baudRate: this.baudRate,
          dataBits: 8,
          parity: 'none',
          stopBits: 1,
          autoOpen: false,
        });
      } catch (e) {
        return reject(new Error(`Nu pot crea portul serial: ${e.message}`));
      }

      // ── Helpers schimb mesaje ─────────────────────────────────────────────

      /** ECR inițiază: ENQ → aştept ACK → trimit frame → aştept ACK → EOT */
      const ecrSend = (frame, nextState, label, timeoutMs = 3000) => {
        log(`ENQ → (${label})`);
        port.write(Buffer.from([ENQ]));
        setState(`WAIT_ENQ_ACK__${nextState}`);
        port._pendingFrame = frame;
        port._nextLabel    = label;
        port._nextState    = nextState;
        armTimeout(`ACK la ENQ (${label})`, timeoutMs);
      };

      /** ECR răspunde la ENQ de la POS */
      const ecrAck = () => port.write(Buffer.from([ACK]));

      // ── Data handler ──────────────────────────────────────────────────────
      port.on('data', (chunk) => {
        if (finished) return;
        rxBuf = Buffer.concat([rxBuf, chunk]);

        while (rxBuf.length > 0 && !finished) {
          const b = rxBuf[0];

          // ── ACK la ENQ-ul nostru ─────────────────────────────────────────
          if (b === ACK && state.startsWith('WAIT_ENQ_ACK__')) {
            rxBuf = rxBuf.subarray(1);
            clearTimeout(stateTimer);
            const frame = port._pendingFrame;
            const ns    = port._nextState;
            const lbl   = port._nextLabel;
            log(`ACK ← ENQ ok (${lbl}). Trimit frame...`);
            port.write(frame);
            setState(`WAIT_FRAME_ACK__${ns}`);
            armTimeout(`ACK la frame (${lbl})`, 3000);
            break;
          }

          // ── ACK la frame-ul nostru ───────────────────────────────────────
          if (b === ACK && state.startsWith('WAIT_FRAME_ACK__')) {
            rxBuf = rxBuf.subarray(1);
            clearTimeout(stateTimer);
            const ns = state.replace('WAIT_FRAME_ACK__', '');

            if (ns === 'LOGIN') {
              log('LOGIN frame acceptat → EOT');
              port.write(Buffer.from([EOT]));
              setState('WAIT_POS_ENQ__LOGIN_RESP');
              armTimeout('ENQ răspuns LOGIN', 5000);

            } else if (ns === 'SALE') {
              log('SALE frame acceptat → EOT. Aştept card (2min)...');
              onStatus('Terminal activat — aşteptați cardul');
              port.write(Buffer.from([EOT]));
              setState('WAIT_POS_ENQ__RESULT');
              armTimeout('card/rezultat tranzacție', 120000);

            } else if (ns === 'FINAL_ACK') {
              log('Rezultat confirmat → EOT → Done');
              port.write(Buffer.from([EOT]));
              // succeed deja apelat înainte
            }
            break;
          }

          // ── NAK ──────────────────────────────────────────────────────────
          if (b === NAK) {
            rxBuf = rxBuf.subarray(1);
            log('⚠ NAK primit');
            break;
          }

          // ── EOT de la POS ────────────────────────────────────────────────
          if (b === EOT) {
            rxBuf = rxBuf.subarray(1);
            log('EOT ← POS');
            break;
          }

          // ── ENQ de la POS (POS inițiează schimb) ─────────────────────────
          if (b === ENQ) {
            rxBuf = rxBuf.subarray(1);
            clearTimeout(stateTimer);
            log(`ENQ ← POS (state=${state})`);
            ecrAck();

            if (state === 'WAIT_POS_ENQ__LOGIN_RESP') {
              setState('WAIT_POS_FRAME__LOGIN_RESP');
              armTimeout('frame LOGIN response', 3000);
            } else if (state === 'WAIT_POS_ENQ__RESULT') {
              setState('WAIT_POS_FRAME__RESULT');
              armTimeout('frame rezultat', 5000);
            }
            break;
          }

          // ── Frame DLE STX...DLE ETX de la POS ────────────────────────────
          if (b === DLE && rxBuf.length >= 2 && rxBuf[1] === STX) {
            const extracted = this._extractFrame(rxBuf);
            if (!extracted) break; // incomplet

            const { cmdBytes, lrcByte, frameEnd } = extracted;
            rxBuf = rxBuf.subarray(frameEnd);
            clearTimeout(stateTimer);

            const calcLRC = this._calcLRC(cmdBytes);
            if (lrcByte !== calcLRC) {
              log(`LRC mismatch! recv=0x${lrcByte.toString(16)} calc=0x${calcLRC.toString(16)}`);
              port.write(Buffer.from([NAK]));
              break;
            }

            // ACK frame valid
            port.write(Buffer.from([ACK]));

            const klasse = cmdBytes[0];
            const instr  = cmdBytes[1];
            const data   = cmdBytes.subarray(3); // după klasse, instr, dlng

            // ── LOGIN response (80/84) ──────────────────────────────────
            if ((klasse === 0x80 || klasse === 0x84) && state === 'WAIT_POS_FRAME__LOGIN_RESP') {
              const ok = (klasse === 0x80) || (klasse === 0x84 && instr === 0x00);
              if (ok) {
                log('LOGIN OK → EOT → inițiez SALE');
                port.write(Buffer.from([EOT]));
                setTimeout(() => ecrSend(SALE_FRAME, 'SALE', 'SALE', 3000), 1000);
              } else {
                fail(`LOGIN refuzat de POS (APRW=0x${instr.toString(16)})`);
              }
              break;
            }

            // ── PIN Entry (05 01) ────────────────────────────────────────
            if (klasse === 0x05 && instr === 0x01) {
              log('PIN Entry — clientul introduce PIN-ul');
              onStatus('PIN Entry — aşteptați');
              port.write(Buffer.from([EOT]));
              setState('WAIT_POS_ENQ__RESULT');
              armTimeout('rezultat după PIN', 120000);
              break;
            }

            // ── Begin Auth (05 02) ───────────────────────────────────────
            if (klasse === 0x05 && instr === 0x02) {
              log('Begin Auth — comunicare cu banca');
              onStatus('Comunicare cu banca...');
              port.write(Buffer.from([EOT]));
              setState('WAIT_POS_ENQ__RESULT');
              armTimeout('rezultat după auth', 120000);
              break;
            }

            // ── Authorization End (06 0F) ─────────────────────────────────
            if (klasse === 0x06 && instr === 0x0F) {
              // Parse Appendix B
              // NOTĂ: XX = DLNG (cmdBytes[2]) — NU este un byte separat în data!
              // data începe direct cu câmpurile (Reference Number, etc.)
              const payload = data;

              const refNum   = payload.subarray(0, 12).toString('ascii').trim();
              const termId   = payload.subarray(12, 20).toString('ascii').trim();
              const txDate   = payload.subarray(20, 32).toString('ascii').trim();
              const amtField = payload.subarray(32, 44).toString('ascii').trim();
              const currency = payload.subarray(44, 47).toString('ascii').trim();
              const authCode = payload.subarray(47, 53).toString('ascii').trim();
              const respCode = payload.subarray(53, 57).toString('ascii').trim();

              // Câmpuri variabile separate prin FS
              const varStr    = payload.subarray(57).toString('ascii');
              const varFields = varStr.split(String.fromCharCode(FS));
              const respText  = (varFields[0] || '').trim();
              const cardNo    = (varFields[1] || '').trim();
              const cardHolder= (varFields[2] || '').trim();
              const pinReceip = (varFields[3] || '').trim();
              const receiptNo = pinReceip.length >= 7 ? pinReceip.slice(1) : pinReceip.slice(0, 6);

              const approved = respCode === '0000';

              log(`Authorization End: respCode=${respCode} authCode=${authCode} refNum=${refNum}`);

              port.write(Buffer.from([EOT]));

              succeed({
                success:   approved,
                code:      respCode,
                authCode,
                refNum,
                receiptNo,
                cardNo,
                cardHolder,
                txDate,
                amount:    amtField,
                currency,
                termId,
                respText,
                raw:       payload.toString('hex'),
              });
              break;
            }

            // ── Refusal (06 1E) ───────────────────────────────────────────
            if (klasse === 0x06 && instr === 0x1E) {
              const errCode = data[0];
              log(`Refusal de la POS, cod=0x${errCode.toString(16)}`);
              port.write(Buffer.from([EOT]));
              succeed({
                success: false,
                code:    errCode.toString(16).toUpperCase(),
                authCode: '',
                refNum: '',
                receiptNo: '',
                raw: '',
                reason: 'Tranzacție refuzată de terminal',
              });
              break;
            }

            // Frame necunoscut
            log(`Frame necunoscut: klasse=0x${klasse.toString(16)} instr=0x${instr.toString(16)}`);
            port.write(Buffer.from([EOT]));
            setState('WAIT_POS_ENQ__RESULT');
            armTimeout('rezultat', 120000);
            break;
          }

          // Byte necunoscut — skip
          rxBuf = rxBuf.subarray(1);
        }
      });

      port.on('error', (err) => {
        log(`Port error: ${err.message}`);
        fail(`Eroare port serial: ${err.message}`);
      });

      port.on('close', () => {
        if (!finished) fail('Port serial închis neaşteptat');
      });

      // Timeout global 10 minute
      const globalTimeout = setTimeout(() => fail('Timeout global 10min'), 600000);
      port.once('close', () => clearTimeout(globalTimeout));

      // ── Pornire ───────────────────────────────────────────────────────────
      port.open((err) => {
        if (err) return fail(`Nu pot deschide portul serial: ${err.message}`);
        log(`Port deschis: ${this.portPath} @ ${this.baudRate} baud 8N1`);
        log(`Sumă: ${amount.toFixed(2)} RON`);
        ecrSend(LOGIN_FRAME, 'LOGIN', 'LOGIN', 3000);
      });
    });
  }

  // ─── Diagnostics ──────────────────────────────────────────────────────────

  /** Listează porturile seriale disponibile pe sistem. */
  static async listPorts() {
    const ports = await SerialPort.list();
    return ports.map(p => ({
      path:         p.path,
      manufacturer: p.manufacturer || null,
      serialNumber: p.serialNumber || null,
      vendorId:     p.vendorId || null,
      productId:    p.productId || null,
    }));
  }
}

module.exports = VerifoneSerialService;
