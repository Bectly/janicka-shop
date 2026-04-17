# GDPR — Customer Data Handling

## Data controller
Janička Shop (provozovatel e-shopu). Kontakt: janicka@janicka-shop.cz.

## Lawful basis
- Smluvní plnění (objednávky, doručení, reklamace)
- Oprávněný zájem (provoz e-shopu, prevence podvodů, audit logu)
- Souhlas (marketingové emaily, cookies kategorií analytics/marketing)
- Právní povinnost (účetnictví — 10 let dle zákona č. 563/1991 Sb.)

## Data we store
- **Customer**: email, jméno, příjmení, telefon (volitelný), adresa (legacy pole),
  heslo (bcrypt), emailVerified, emailové preference (notifyMarketing), admin poznámky
  a tagy (pouze pro interní použití).
- **CustomerAddress**: uložené dodací adresy (1:N vůči Customer).
- **CustomerWishlist**: odkazy na produkty.
- **Order / OrderItem / Return / ReturnItem**: historie objednávek, vratek, platby.
- **CustomerAuditLog**: události (login, změna profilu, admin akce) s IP + user
  agentem + metadata (JSON). Uchovává se 90 dní.
- **NewsletterSubscriber**: email + zájmy + preferovaná frekvence (souhlasem).

## Retention policy
| Typ dat | Doba uchování | Důvod |
| --- | --- | --- |
| Orders + OrderItems + Returns | **10 let** | Zákon č. 563/1991 Sb. (účetnictví) |
| Customer profile | Do vymazání účtu | Smluvní plnění |
| CustomerAddress | Do vymazání účtu / smazání adresy | Smluvní plnění |
| CustomerWishlist | Do vymazání účtu / odstranění položky | Oprávněný zájem |
| CustomerAuditLog | **90 dní** (FIFO) | Oprávněný zájem — bezpečnost |
| NewsletterSubscriber | Do odhlášení | Souhlas |

> Audit log starší než 90 dní se odstraňuje periodickým cron jobem
> (`scripts/cleanup-audit-log.ts` — TODO post-v1).

## Customer rights (GDPR)
### Art. 15 — Právo na přístup
Zákaznice vidí svá data přímo v `/account/profile`, `/account/adresy`,
`/account/oblibene`, `/account/orders` a `/account/nastaveni` (aktivita).

### Art. 17 — Právo na výmaz
`/account/nastaveni` → "Smazat účet". V1 = okamžitý soft-delete (bez 7denní lhůty):
- `email` → `deleted-<cuid>@janicka.local`
- `firstName` → `Smazaný`
- `lastName` → `Uživatel`
- `phone/street/city/zip` → prázdné
- `password` → null (znemožňuje login)
- `deletedAt` → now()
- `CustomerAddress` + `CustomerWishlist` → hard delete (transakce)
- `NewsletterSubscriber` s daným emailem → anonymizace (email na deleted-*, firstName null)
- Orders + Returns zůstávají (účetní povinnost)
- Do old-emailu se pošle `sendAccountDeletedEmail`
- Událost `account_delete` se zapíše do auditu před anonymizací

> Follow-up post-v1: 7denní grace period s možností undo. Zatím není.

### Art. 20 — Právo na přenositelnost
`/account/nastaveni` → "Stáhnout moje data" → `POST /api/customer/data-export`.
- Rate limit 1× za 24 hodin (perzistentně přes `Customer.lastDataExportAt`)
- Vrací strojově čitelný JSON bundle (profil, adresy, objednávky, vratky,
  wishlist, newsletter prefs, login history — posledních 200 událostí)
- Nezahrnuje admin-only pole (internalNote, tags)
- Exekuce zapsána do auditu jako `gdpr_export`
- Response hlavička `Content-Disposition: attachment; filename="janicka-data-<date>.json"`

### Art. 16 — Právo na opravu
Profil, adresy, email (`/account/change-email` s password confirm + 24h gate +
1h ověřovací token na nový email + notifikace na starý email).

### Art. 7 — Odvolání souhlasu
- Marketing: `/account/nastaveni` → checkbox + okamžitá aktualizace `Customer.notifyMarketing`
- Newsletter: unsubscribe link v každém emailu
- Cookies: `/cookies` banner + správa kategorií

## Audit log actions
Logované události (`CustomerAuditLog.action`):
- `login`, `logout`, `password_change`, `password_reset`
- `profile_update`, `email_change_request`, `email_change_confirmed`
- `address_add`, `address_update`, `address_delete`
- `wishlist_add`, `wishlist_remove`
- `marketing_subscribe`, `marketing_unsubscribe`
- `gdpr_export`, `account_delete`
- `admin_profile_edit`, `admin_unlock`, `admin_disable`, `admin_enable`,
  `admin_anonymize`, `admin_force_reset`

## Anonymization scope
Při smazání účtu (Art. 17) nebo admin `admin_anonymize`:
- PII: email, jméno, příjmení, telefon, adresní pole
- Hard-delete: `CustomerAddress`, `CustomerWishlist`
- Zůstává: `Order` + `OrderItem` (účetní povinnost), `Return`, `CustomerAuditLog`
  (po 90 dnech spadne), `deletedAt` timestamp

## Breach notification
V případě úniku dat informujeme ÚOOÚ do 72 hodin a dotčené zákaznice neprodleně
emailem (pokud je kontakt stále validní). Šablona not yet implemented.

## Contacts
- Zpracovatel: Janička Shop
- Dozorový orgán: Úřad pro ochranu osobních údajů (ÚOOÚ), www.uoou.cz
- Právo na stížnost: ÚOOÚ nebo soudní cesta
