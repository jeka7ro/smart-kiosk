# Agent Rules

## STRICT RULE: DO NOT DELETE USER DATA
ESTE UN ORDIN! NU AI VOIE SĂ ȘTERGI NIMIC DIN BAZA DE DATE SAU DIN FIȘIERE FĂRĂ ACORDUL EXPLICIT AL UTILIZATORULUI. Dacă utilizatorul nu cere o curățare de date (wipe/delete), nu șterge absolut niciun istoric, mock sau date din locații, fișiere .json, etc. Ești obligat să respecți datele reale și să nu le suprascrii niciodată.

## STRICT RULE: NO PUSH WITHOUT PERMISSION
NICIODATĂ nu vei rula comenzi precum `git push` fără ca utilizatorul să ceară asta în mod explicit!

## STRICT RULE: DO NOT TOUCH FOREIGN FOLDERS OR APPS
NU AI VOIE să navighezi sau să scrii cod în foldere străine de workspace-ul proiectului curent, și nu ai voie să atingi alte aplicații sau proiecte fără cerere expresă!

## STRICT RULE: DO NOT IMPROVISE OR MAKE UNPROMPTED CHANGES
ESTE STRICT INTERZIS SĂ FACI DE CAPUL TĂU, SĂ MODIFICI SAU SĂ IMPROVIZEZI! Vei executa EXCLUSIV și STRICT ceea ce ți se cere de către utilizator, fără să adaugi, să ștergi sau să schimbi funcționalități nesolicitate. Respectă la literă comenzile utilizatorului.

## CRITICAL KNOWLEDGE: POS "A0" ERROR (PRINTEC/RAIFFEISEN)
Dacă POS-ul Printec ECR dă eroarea "A0" (Tranzacție refuzată de terminal) la câteva secunde după ce ecranul afișează "Apropiați cardul", **problema NU este din cod**. POS-ul are memoria blocată și trebuie resetat manual sau golit.
Soluția dovedită:
1. Închide complet POS Bridge-ul (programul) ca POS-ul să iasă din modul "ECR".
2. Fă "Închidere de Zi" / "Settlement" direct din butoanele POS-ului fizic.
3. Repornește Bridge-ul.
NOTĂ: Închiderea de Zi trebuie făcută zilnic (seara) pentru a preveni blocarea memoriei POS-ului.
Codul stabil este v7.2 (care include secvența `LOGIN` -> așeptare -> `SALE`). Nu modifica codul bridge-ului pentru erori A0.
