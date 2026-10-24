/**
 * Istoricul oficial al versiunilor și noutăților Smart Kiosk POS Bridge
 * Formatat conform standardului Apple macOS Software Update
 */

export const BRIDGE_RELEASE_NOTES = [
  {
    version: '3.5.2',
    releaseDate: '24 Octombrie 2026',
    isLatest: true,
    tag: 'Stabilitate Rețea & Reconectare Nativă',
    title: 'Eliminare Oprire la Deconectare & Persistență Conexiune',
    summary: 'Elimină complet timer-ul de oprire la deconectare de internet. Bridge-ul rămâne activ pe calculator, ține portul POS și imprimanta deschise, iar Socket.io se reconectează automat și silențios în secunda în care revine semnalul de internet.',
    categories: [
      {
        title: 'Reconectare & Persistență',
        badge: 'Critic',
        badgeColor: 'emerald',
        items: [
          {
            title: 'Eliminare process.exit la Lipsă Rețea',
            desc: 'Procesul Node.js nu se mai auto-oprește la căderi de internet, prevenind blocarea terminalului.'
          },
          {
            title: 'Sondă Sănătate Locală Permanent Activă',
            desc: 'Portul 40499 raportează ALIVE:OK cât timp procesul este activ pe PC, eliminând intervențiile premature ale watchdog-ului.'
          },
          {
            title: 'Decuplare Watchdog de Consola Batch',
            desc: 'Watchdog-ul rulează ca proces de sine stătător în Windows, protejat împotriva închiderii accidentale.'
          }
        ]
      }
    ]
  },
  {
    version: '3.5.1',
    releaseDate: '23 Octombrie 2026',
    isLatest: false,
    tag: 'Tanc Blindat Auto-Recuperabil',
    title: 'Watchdog Proactiv: Auto-Kill Zombie & Auto-Restart la Deconectare',
    summary: 'Elimină definitiv starea de zombie când portul COM sau socket-ul se deconectează. Dacă bridge-ul rămâne deconectat de Render > 60s, procesul se auto-termină forțat pentru a permite buclei batch să repornească curat. Watchdog-ul local verifică activ conexiunea înainte de a raporta starea ALIVE.',
    categories: [
      {
        title: 'Auto-Recuperare & Watchdog',
        badge: 'Critic',
        badgeColor: 'emerald',
        items: [
          {
            title: 'Auto-Exit la Deconectare Render (>60s)',
            desc: 'Dacă bridge-ul pierde conexiunea socket cu Render și nu se reconectează în 60s, procesul apelează process.exit(1) pentru a fi repornit curat de bucla start-windows.bat.'
          },
          {
            title: 'Sondă Sănătate Inteligentă (Port 40499)',
            desc: 'Portul 40499 raportează ALIVE:OK strict dacă bridge-ul este activ conectat la Render. În caz de stare zombie, raportează DEAD, declanșând taskkill-ul automat din watchdog.vbs.'
          },
          {
            title: 'Timer de Siguranță pe Resetare Port COM (2.5s)',
            desc: 'Previne blocarea thread-ului pe Windows în apeluri de închidere/deschidere a portului serial.'
          }
        ]
      }
    ]
  },
  {
    version: '3.5.0',
    releaseDate: '21 Octombrie 2026',
    isLatest: false,
    tag: 'Versiune Oficială',
    title: 'Patch Critic: Auto-Repornire Nativă & Eliminare Crash Batch',
    summary: 'Această actualizare rezolvă definitiv problema de repornire pe Windows. Procesul Node.js se repornește acum nativ în sub 1 secundă fără a mai depinde de scriptul extern de batch, iar porturile UART/COM sunt eliberate ordonat.',
    categories: [
      {
        title: 'Stabilitate & Auto-Repornire',
        badge: 'Critic',
        badgeColor: 'emerald',
        items: [
          {
            title: 'Repornire Nativă Instantanee (Detached Spawn)',
            desc: 'Noul proces Node.js pornește direct din interior înainte de închiderea instanței vechi, garantând revenire în 1 secundă la actualizări.'
          },
          {
            title: 'Eliminare Risc Crash start-windows.bat',
            desc: 'A fost eliminată comanda de auto-suprascriere a scriptului batch în execuție, prevenind închiderea forțată a ferestrei cmd.exe pe Windows.'
          },
          {
            title: 'Eliberare Curată Resurse Hardware (COM & Socket)',
            desc: 'Portul serial și conexiunea Socket.io sunt eliberate grațios înainte de exit pentru a asigura reconectarea imediată a terminalului Verifone.'
          }
        ]
      }
    ]
  },
  {
    version: '3.4.0',
    releaseDate: '21 Octombrie 2026',
    isLatest: false,
    tag: 'Versiune Anterioară',
    title: 'Unificare Flotă, Eliminare Foldere Legacy și Management Stil Apple',
    summary: 'Această actualizare aduce standardizarea completă a tuturor celor 4 kiosk-uri din rețea, unifică calea unică de rulare și introduce protecție avansată împotriva alarmelor false.',
    categories: [
      {
        title: 'Noutăți & Standardizare Sistem',
        badge: 'Nou',
        badgeColor: 'blue',
        items: [
          {
            title: 'Sincronizare Automată Flotă',
            desc: 'Toate cele 4 locații (Cluj 1 Centru, Cluj 2, Brașov, Constanța) rulează acum sincronizat aceeași versiune v3.4.0, eliminând discrepanțele dintre restaurante.'
          },
          {
            title: 'Curățare Automată Foldere Legacy',
            desc: 'La pornire, scriptul elimină automat vechile foldere redundante de pe Windows (kiosk_jk, KIOSKV2, POSINTEGRAT), păstrând exclusiv folderul oficial C:\\SmartKiosk.'
          },
          {
            title: 'Interfață Actualizări Stil Apple macOS',
            desc: 'Indicator inteligent pe panou: când totul este la zi, afișează un badge discret și curat, iar butonul de actualizare apare doar când există o versiune nouă pe server.'
          }
        ]
      },
      {
        title: 'Stabilitate Hardware & POS Verifone',
        badge: 'Hardware',
        badgeColor: 'emerald',
        items: [
          {
            title: 'Filtru Inteligent Anti-Alarme False',
            desc: 'Interval de grație de 35 de secunde pentru deconectări. Repornirile scurte de mentenanță nu mai declanșează pop-up-uri intruzive pe ecran.'
          },
          {
            title: 'Watchdog & Health-Check TCP',
            desc: 'Procesul Bridge include monitorizare activă a stării portului serial și repornire automată în caz de blocare a driverului COM.'
          },
          {
            title: 'Detecție Automată Hostname',
            desc: 'Scriptul universal identifică automat calculatorul (ex: DESKTOP-44PEN14) și selectează portul COM și imprimanta potrivită fără configurare manuală.'
          }
        ]
      },
      {
        title: 'Rezolvări de Probleme & Performanță',
        badge: 'Corecții',
        badgeColor: 'purple',
        items: [
          {
            title: 'Deduplicare Instanțe Multiple',
            desc: 'Sistemul detectează și închide automat orice a doua instanță deschisă accidental în fundal, prevenind blocajele de port serial.'
          },
          {
            title: 'Clarificare Buton Dashboard',
            desc: 'Redenumit butonul de refresh din pagină în „Reîmprospătează”, eliminând confuzia cu actualizarea de soft.'
          }
        ]
      }
    ]
  },
  {
    version: '3.3.0',
    releaseDate: '20 Octombrie 2026',
    isLatest: false,
    tag: 'Anterioară',
    title: 'Scut UART Half-Duplex și Retenție Sesiune Login',
    summary: 'Implementarea strictă a protocolului Printec ECR v3.9.3 și prevenirea coliziunilor hardware pe magistrala serială Verifone.',
    categories: [
      {
        title: 'Protocol POS Printec v3.9.3',
        badge: 'Protocol',
        badgeColor: 'emerald',
        items: [
          {
            title: 'Scut Half-Duplex UART',
            desc: 'Eliminarea definitivă a coliziunilor dintre semnalele de auto-wake și tranzacțiile inițiate de clienți.'
          },
          {
            title: 'Retenție Sesiune Login',
            desc: 'Starea de autentificare cu banca se menține activă chiar și la căderi temporare de rețea, fără a necesita re-login la fiecare bon.'
          }
        ]
      },
      {
        title: 'Recuperare la Anulare',
        badge: 'POS',
        badgeColor: 'blue',
        items: [
          {
            title: 'Tăiere Semnal DTR/RTS la Anulare',
            desc: 'Când clientul apasă Anulează pe ecran, terminalul Verifone V200t este eliberat instantaneu prin reset controlat de 300ms al portului serial.'
          }
        ]
      }
    ]
  },
  {
    version: '3.2.0',
    releaseDate: '19 Octombrie 2026',
    isLatest: false,
    tag: 'Anterioară',
    title: 'Pre-Wake la Atingere și Integrare Telegram Avansată',
    summary: 'Reducerea timpului de așteptare la plată prin trezirea anticipată a POS-ului și monitorizare mobilă prin Telegram.',
    categories: [
      {
        title: 'Optimizare Timp Plată',
        badge: 'Viteză',
        badgeColor: 'amber',
        items: [
          {
            title: 'Pre-Wake POS la Atingerea Ecranului',
            desc: 'Terminalul Verifone iese din modul de hibernare imediat ce clientul atinge prima dată meniul, fiind gata instant la finalizarea comenzii.'
          },
          {
            title: 'Standby Inteligent Configurabil',
            desc: 'Posibilitate de activare/dezactivare din panou a trezirii periodice pentru orele de vârf.'
          }
        ]
      },
      {
        title: 'Monitorizare Telegram',
        badge: 'Alerte',
        badgeColor: 'blue',
        items: [
          {
            title: 'Comandă Telegram /pos',
            desc: 'Raport instant în Telegram cu starea fiecărui kiosk, timpii de răspuns și eventualele alerte hardware.'
          }
        ]
      }
    ]
  },
  {
    version: '3.1.0',
    releaseDate: '15 Octombrie 2026',
    isLatest: false,
    tag: 'Anterioară',
    title: 'Arhitectură Universală Imprimante & Multi-Locație',
    summary: 'Suport nativ pentru imprimante termice Epson și XPrinter pe toate sistemele Windows.',
    categories: [
      {
        title: 'Compatibilitate Imprimante',
        badge: 'Hardware',
        badgeColor: 'purple',
        items: [
          {
            title: 'Driver Unificat EPSON TM-T20 & XP-80',
            desc: 'Tipărire directă rapidă a bonurilor fiscale și a notelor de comandă fără blocare de spooler Windows.'
          }
        ]
      }
    ]
  }
];

export function getReleaseNotesForVersion(version) {
  if (!version) return BRIDGE_RELEASE_NOTES[0];
  const cleanVer = String(version).replace(/^v/i, '').trim();
  return BRIDGE_RELEASE_NOTES.find(r => r.version === cleanVer) || BRIDGE_RELEASE_NOTES[0];
}
