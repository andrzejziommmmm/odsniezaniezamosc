#!/usr/bin/env python3
"""
Pobiera ostrzeżenia przed śniegiem i oblodzeniem:
  - Polska: IMGW-PIB, https://danepubliczne.imgw.pl/api/data/warningsmeteo
  - Europa: MeteoAlarm (EUMETNET), kanały Atom dla każdego kraju
i zapisuje je do data/ostrzezenia.json. Uruchamiany przez GitHub Actions.
Tylko biblioteka standardowa Pythona.
"""
import json, os, re, sys, urllib.request, xml.etree.ElementTree as ET
from datetime import datetime, timezone, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'ostrzezenia.json')
TEST_DIR = os.environ.get('OSTRZ_TEST_DIR')  # do testów: pliki zamiast internetu
UA = 'odsniezaniezamosc.pl ostrzezenia-sniegowe (GitHub Actions)'

IMGW_URL = 'https://danepubliczne.imgw.pl/api/data/warningsmeteo'
MA_URL = 'https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-{}'
KRAJE = {
    'AD': 'andorra', 'AT': 'austria', 'BA': 'bosnia-herzegovina', 'BE': 'belgium', 'BG': 'bulgaria', 'HR': 'croatia',
    'CY': 'cyprus', 'CZ': 'czechia', 'DK': 'denmark', 'EE': 'estonia', 'FI': 'finland', 'FR': 'france', 'DE': 'germany',
    'GR': 'greece', 'HU': 'hungary', 'IS': 'iceland', 'IE': 'ireland', 'IT': 'italy', 'LV': 'latvia', 'LT': 'lithuania',
    'LU': 'luxembourg', 'MT': 'malta', 'MD': 'moldova', 'ME': 'montenegro', 'NL': 'netherlands',
    'MK': 'republic-of-north-macedonia', 'NO': 'norway', 'PL': 'poland', 'PT': 'portugal', 'RO': 'romania', 'RS': 'serbia',
    'SK': 'slovakia', 'SI': 'slovenia', 'ES': 'spain', 'SE': 'sweden', 'CH': 'switzerland', 'UA': 'ukraine',
    'GB': 'united-kingdom',
}

# Zjawiska IMGW związane ze śniegiem i lodem
PL_SNIEG = re.compile(r'śnieg|zawie|zamie|oblodz|marzn|gołoledź|szadź', re.I)
# Słowa „śnieg/lód/oblodzenie” w językach krajów MeteoAlarm + typ „snow-ice”
EU_SNIEG = re.compile(
    r'snow|\bice\b|icy|blizzard|śnieg|oblodz|schnee|glätte|glatteis|neige|verglas|ghiaccio|gelicidio|\bneve\b|nieve|hielo|'
    r'sneeuw|gladheid|ijzel|sníh|sněh|sněž|snež|náledí|ledovk|\bsneh|poľadovic|\bhó\b|havaz|ónos|\bsne\b|snø|snö|halka|lumi|liukk|'
    r'sniegs|sniego|sniegas|apledo|zăpad|polei|viscol|сніг|ожеледь|хуртовин|snijeg|\bsneg|poledic|χιόν|παγετ|snjór|'
    r'snow-ice', re.I)
SEV = {'minor': 0, 'moderate': 1, 'severe': 2, 'extreme': 3}


def pobierz(url, plik_testowy):
    if TEST_DIR:
        p = os.path.join(TEST_DIR, plik_testowy)
        if not os.path.exists(p):
            raise FileNotFoundError(p)
        return open(p, 'rb').read()
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': '*/*'})
    with urllib.request.urlopen(req, timeout=40) as r:
        return r.read()


def teraz():
    return datetime.now(timezone.utc)


def czas_pl(s):
    """'2026-11-26 08:00:00' (czas polski) -> ISO z offsetem."""
    if not s:
        return None
    try:
        d = datetime.strptime(s.strip()[:19], '%Y-%m-%d %H:%M:%S')
    except ValueError:
        return s
    # Polska: CET (+1) zimą, CEST (+2) latem – ostatnia niedziela marca / października
    def ost_niedz(rok, mies):
        d0 = datetime(rok, mies + 1, 1) - timedelta(days=1) if mies < 12 else datetime(rok, 12, 31)
        return d0 - timedelta(days=(d0.weekday() + 1) % 7)
    lato = ost_niedz(d.year, 3).replace(hour=2) <= d < ost_niedz(d.year, 10).replace(hour=3)
    return d.replace(tzinfo=timezone(timedelta(hours=2 if lato else 1))).isoformat()


def iso_parse(s):
    try:
        return datetime.fromisoformat(s.replace('Z', '+00:00'))
    except Exception:
        return None


# ------------------------------------------------------------------ POLSKA
def polska():
    dane = json.loads(pobierz(IMGW_URL, 'imgw.json').decode('utf-8'))
    wynik = []
    for o in dane:
        nazwa = (o.get('nazwa_zdarzenia') or '').strip()
        if not PL_SNIEG.search(nazwa):
            continue
        do = czas_pl(o.get('obowiazuje_do'))
        dt = iso_parse(do) if do else None
        if dt and dt < teraz():
            continue
        teryt = sorted({str(t)[:4] for t in (o.get('teryt') or []) if str(t).strip()})
        try:
            st = int(str(o.get('stopien') or '1').strip()[:1])
        except ValueError:
            st = 1
        wynik.append({
            'id': str(o.get('id') or ''),
            'zjawisko': nazwa,
            'stopien': max(1, min(3, st)),
            'prawd': str(o.get('prawdopodobienstwo') or '').strip(),
            'od': czas_pl(o.get('obowiazuje_od')),
            'do': do,
            'tresc': (o.get('tresc') or '').strip(),
            'komentarz': (o.get('komentarz') or '').strip(),
            'biuro': (o.get('biuro') or '').strip(),
            'teryt': teryt,
        })
    wynik.sort(key=lambda w: (-w['stopien'], w['od'] or ''))
    return wynik


# ------------------------------------------------------------------ EUROPA
def lokalna(tag):
    return tag.rsplit('}', 1)[-1].lower()


def kraj(kod, slug):
    xml = pobierz(MA_URL.format(slug), f'ma-{slug}.xml')
    root = ET.fromstring(xml)
    obszary, zjawiska, maks, koniec = set(), {}, 0, None
    for e in root.iter():
        if lokalna(e.tag) != 'entry':
            continue
        f = {}
        for c in e:
            f.setdefault(lokalna(c.tag), (c.text or '').strip())
        if f.get('status', 'actual').lower() not in ('actual', ''):
            continue
        if (f.get('msgtype') or f.get('message_type') or '').lower() == 'cancel':
            continue
        ev = f.get('event', '')
        typ = f.get('awareness_type', '')
        if not (EU_SNIEG.search(ev) or 'snow' in typ.lower()):
            continue
        exp = iso_parse(f.get('expires', '')) if f.get('expires') else None
        if exp and exp < teraz():
            continue
        lvl = SEV.get(f.get('severity', '').lower(), 0)
        al = re.match(r'\s*(\d)', f.get('awareness_level', ''))
        if al:
            lvl = max(lvl, int(al.group(1)) - 1)
        if lvl < 1:
            continue
        maks = max(maks, lvl)
        obszary.add(f.get('areadesc') or f.get('title') or ev)
        zjawiska[ev] = max(zjawiska.get(ev, 0), lvl)
        if exp and (koniec is None or exp > koniec):
            koniec = exp
    if not maks:
        return None
    top = sorted(zjawiska.items(), key=lambda x: -x[1])[:3]
    return {'stopien': maks, 'obszary': len(obszary), 'przyklady': sorted(obszary)[:6],
            'zjawiska': [z for z, _ in top], 'do': koniec.isoformat() if koniec else None}


def europa():
    wynik, bledy = {}, []
    for kod, slug in KRAJE.items():
        try:
            k = kraj(kod, slug)
            if k:
                wynik[kod] = k
        except Exception as ex:
            bledy.append(kod)
            print(f'MeteoAlarm {kod}: {ex}', file=sys.stderr)
    return wynik, bledy


def main():
    stare = {}
    if os.path.exists(OUT):
        try:
            stare = json.load(open(OUT, encoding='utf-8'))
        except Exception:
            stare = {}

    nowe = {'zrodla': {
        'pl': 'IMGW-PIB, danepubliczne.imgw.pl',
        'eu': 'MeteoAlarm / EUMETNET, meteoalarm.org'}}
    try:
        nowe['pl'] = polska(); nowe['pl_ok'] = True
    except Exception as ex:
        print('IMGW:', ex, file=sys.stderr)
        nowe['pl'] = stare.get('pl', []); nowe['pl_ok'] = False
    eu, bledy = europa()
    if len(bledy) == len(KRAJE):
        nowe['eu'] = stare.get('eu', {}); nowe['eu_ok'] = False
    else:
        nowe['eu'] = eu; nowe['eu_ok'] = True
    nowe['eu_bledy'] = bledy

    # Nie zapisuj, jeśli nic się nie zmieniło, a ostatni zapis ma mniej niż 3 godziny
    porownaj = lambda d: json.dumps({k: v for k, v in d.items() if k != 'aktualizacja'}, sort_keys=True, ensure_ascii=False)
    ost = iso_parse(stare.get('aktualizacja', '')) if stare.get('aktualizacja') else None
    if stare and porownaj(stare) == porownaj(nowe) and ost and teraz() - ost < timedelta(hours=3):
        print('Bez zmian.')
        return
    nowe['aktualizacja'] = teraz().replace(microsecond=0).isoformat()
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(nowe, fh, ensure_ascii=False, indent=1)
    print(f"Zapisano: PL {len(nowe['pl'])} ostrzeżeń, EU {len(nowe['eu'])} krajów, błędy: {bledy}")


if __name__ == '__main__':
    main()
