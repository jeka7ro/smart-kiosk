/**
 * scan_port_pc.js — Scaneaza porturile COM si imprimantele instalate pe PC
 * Returneaza un obiect cu toate informatiile hardware gasite.
 * COMPLET ASINCRON: Nu blocheaza niciodata firul Node.js / ping-ul Socket.IO.
 */
const { exec } = require('child_process');
const { SerialPort } = require('serialport');

function execAsync(cmd, timeoutMs = 3000) {
  return new Promise((resolve) => {
    try {
      exec(cmd, { timeout: timeoutMs, windowsHide: true }, (err, stdout) => {
        if (err) return resolve('');
        resolve(String(stdout || '').trim());
      });
    } catch (_) {
      resolve('');
    }
  });
}

async function scanPortsPc() {
  const result = {
    comPorts: [],
    printers: [],
    printJobs: [],
    hostname: '',
    os: '',
    scanDate: new Date().toISOString(),
  };

  // ─── HOSTNAME + OS ────────────────────────────────
  try {
    result.hostname = require('os').hostname();
    result.os = `${require('os').platform()} ${require('os').release()}`;
  } catch (_) {}

  // ─── COM PORTS ────────────────────────────────────
  try {
    const ports = await SerialPort.list();
    result.comPorts = ports.map(p => ({
      path: p.path,
      manufacturer: p.manufacturer || '',
      serialNumber: p.serialNumber || '',
      vendorId: p.vendorId || '',
      productId: p.productId || '',
      pnpId: p.pnpId || '',
    }));
    console.log(`[Scan] Porturi COM găsite: ${result.comPorts.length}`);
    result.comPorts.forEach(p => {
      console.log(`  → ${p.path} | ${p.manufacturer || 'necunoscut'} | PnP: ${p.pnpId || '-'}`);
    });
  } catch (e) {
    console.error(`[Scan] Eroare la scanare porturi COM:`, e.message);
  }

  // ─── PRINTERS (Windows PowerShell Asincron) ───────
  try {
    const psCmd = `Get-Printer | Select-Object Name, DriverName, PortName, PrinterStatus, Shared | ConvertTo-Json -Compress`;
    let raw = await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCmd}"`, 3000);

    let parsed = [];
    if (raw) {
      try {
        parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) parsed = [parsed];
      } catch (_) {}
    }

    if (!parsed || parsed.length === 0) {
      // fallback: try wmic asincron
      try {
        const wmicRaw = await execAsync('wmic printer get Name,PortName,DriverName /format:csv', 2000);
        if (wmicRaw) {
          const lines = wmicRaw.split('\n').filter(l => l.trim() && !l.startsWith('Node'));
          parsed = lines.map(line => {
            const parts = line.split(',');
            return { DriverName: parts[1] || '', Name: parts[2] || '', PortName: parts[3] || '' };
          });
        }
      } catch (__) {}
    }

    result.printers = (parsed || []).map(p => ({
      name: p.Name || '',
      driver: p.DriverName || '',
      port: p.PortName || '',
      status: p.PrinterStatus !== undefined ? p.PrinterStatus : null,
      shared: p.Shared || false,
    }));

    console.log(`[Scan] Imprimante instalate: ${result.printers.length}`);
    result.printers.forEach(p => {
      console.log(`  🖨️  ${p.name} | Driver: ${p.driver} | Port: ${p.port}`);
    });
  } catch (e) {
    console.error(`[Scan] Eroare la scanare imprimante:`, e.message);
  }

  // ─── PRINT QUEUE & PAUSED STATUS (Asincron) ───────
  try {
    const qCmd = `Get-Printer -ErrorAction SilentlyContinue | ForEach-Object { Get-PrintJob -PrinterName $_.Name -ErrorAction SilentlyContinue } | Select-Object Id, PrinterName, JobStatus, DocumentName | ConvertTo-Json -Compress`;
    const qRaw = await execAsync(`powershell -NoProfile -Command "${qCmd}"`, 2500);
    if (qRaw) {
      try {
        const qParsed = JSON.parse(qRaw);
        result.printJobs = Array.isArray(qParsed) ? qParsed : [qParsed];
        console.log(`[Scan] ⚠️ Joburi blocate în coada Windows: ${result.printJobs.length}`);
        result.printJobs.forEach(j => {
          console.log(`   → Job #${j.Id} pe "${j.PrinterName}": status="${j.JobStatus}", doc="${j.DocumentName}"`);
        });
      } catch (_) {
        result.printJobs = [];
      }
    } else {
      result.printJobs = [];
      console.log('[Scan] ✅ Coada Windows este liberă (0 joburi blocate).');
    }
  } catch (_) {
    result.printJobs = [];
  }

  return result;
}

module.exports = { scanPortsPc };
