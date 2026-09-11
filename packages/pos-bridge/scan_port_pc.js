/**
 * scan_port_pc.js — Scaneaza porturile COM si imprimantele instalate pe PC
 * Returneaza un obiect cu toate informatiile hardware gasite.
 */
const { execSync } = require('child_process');
const { SerialPort } = require('serialport');

async function scanPortsPc() {
  const result = {
    comPorts: [],
    printers: [],
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

  // ─── PRINTERS (Windows PowerShell) ────────────────
  try {
    const psCmd = `Get-Printer | Select-Object Name, DriverName, PortName, PrinterStatus, Shared | ConvertTo-Json -Compress`;
    const raw = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCmd}"`, { timeout: 10000 }).toString().trim();
    
    let parsed = [];
    try {
      parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) parsed = [parsed]; // single printer = object
    } catch (_) {
      // fallback: try wmic
      try {
        const wmicRaw = execSync('wmic printer get Name,PortName,DriverName /format:csv', { timeout: 10000 }).toString().trim();
        const lines = wmicRaw.split('\n').filter(l => l.trim() && !l.startsWith('Node'));
        parsed = lines.map(line => {
          const parts = line.split(',');
          return { DriverName: parts[1] || '', Name: parts[2] || '', PortName: parts[3] || '' };
        });
      } catch (__) {}
    }

    result.printers = parsed.map(p => ({
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

  return result;
}

module.exports = { scanPortsPc };
