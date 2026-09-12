const express = require('express');
const router = express.Router();

/**
 * Normalizes CUI: strips 'RO', whitespace, dots, dashes
 * Returns string of digits or null
 */
function normalizeCui(raw) {
  if (!raw) return null;
  const digits = String(raw).trim().toUpperCase().replace(/^RO/, '').replace(/[^0-9]/g, '');
  return (/^\d{2,10}$/.test(digits)) ? digits : null;
}

async function queryAnaf(cleanCui) {
  const today = new Date().toISOString().slice(0, 10);
  const url = 'https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva';
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'User-Agent': 'SmartKiosk/1.0 (ANAF-Lookup)'
      },
      body: JSON.stringify([{ cui: Number(cleanCui), data: today }]),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`ANAF server responded with status: ${response.status}`);
    }

    const json = await response.json();
    const company = json?.found?.[0];

    if (!company) {
      return { found: false, message: 'Firma nu a fost găsită în baza de date ANAF.' };
    }

    const dg = company.date_generale || {};
    const tvaScope = company.inregistrare_scop_Tva?.scpTVA || false;
    const sediu = company.adresa_sediu_social || {};

    const rawCuiWithPrefix = (tvaScope ? 'RO' : '') + cleanCui;

    return {
      found: true,
      data: {
        cui: cleanCui,
        rawCui: rawCuiWithPrefix,
        name: dg.denumire ? dg.denumire.trim() : '',
        address: dg.adresa ? dg.adresa.trim() : '',
        city: sediu.sdenumire_Localitate || '',
        county: sediu.sdenumire_Judet || '',
        regCom: dg.nrRegCom ? dg.nrRegCom.trim() : '',
        isVatPayer: Boolean(tvaScope),
        phone: dg.telefon || '',
        state: dg.stare_inregistrare || 'ACTIVA',
      }
    };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      throw new Error('Serviciul ANAF nu a răspuns la timp (timeout).');
    }
    throw err;
  }
}

// Handler for both GET and POST
async function handleLookup(req, res) {
  const rawCui = req.params.cui || req.body.cui || req.query.cui;
  const cleanCui = normalizeCui(rawCui);

  if (!cleanCui) {
    return res.status(400).json({
      success: false,
      error: 'CUI invalid. Introduceți un cod fiscal valid (2-10 cifre, cu sau fără RO).'
    });
  }

  try {
    const result = await queryAnaf(cleanCui);
    if (!result.found) {
      return res.status(404).json({
        success: false,
        error: result.message
      });
    }

    return res.json({
      success: true,
      company: result.data
    });
  } catch (err) {
    console.error(`[ANAF] Lookup error for CUI ${cleanCui}:`, err.message);
    return res.status(502).json({
      success: false,
      error: `Eroare la comunicarea cu serverul ANAF: ${err.message}`
    });
  }
}

router.get('/lookup/:cui', handleLookup);
router.post('/lookup', handleLookup);

module.exports = router;
