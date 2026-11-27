#!/usr/bin/env python3
"""Setup Worldwide Shopify v6.0 — Engine parametrizada (ressincronizado com a skill v5.7,
API Mercados Unificados)
Executa fases 1B/2/3A-B/4/5/6 via shopify CLI (Admin GraphQL).
Fases UI (0 moeda, 0.5 endereco, 0.6 fuso, 3C idioma padrao, 6.5 checkout, 8 senha, 9 apps)
ficam manuais via Chrome MCP — fora deste engine.

v6.0 (2026-09-03): reescrito depois de confirmar por introspecao ao vivo que o schema mudou
para o modelo de Mercados Unificados desde que este arquivo foi escrito pela ultima vez
(v3.0): marketCreate NAO aceita mais `regions` direto, e sim `conditions.regionsCondition`.
A lista de paises "alocaveis" deixa de ser uma lista hardcoded (que cobria so ~113 paises)
e passa a ser lida do enum CountryCode do proprio schema, menos os banidos — cobertura real
236/236 paises, calculada na hora contra a loja de destino. Fase 1 passa a carregar
policy_templates.json (fonte unica) em vez de templates soltos no .py. Fase 5 usa o layout
fixo de 6 zonas com nomes de tarifa no idioma local, sem prazo (regra NON-NEGOTIABLE).

v6.0 tambem troca `shopify store execute` (subprocess) por chamada HTTP direta na Admin
API, lendo o token do config do CLI (mesmo padrao do scripts/v2/lib.mjs do cofre de lojas):
no Windows, `subprocess.run(["shopify", ...])` sem shell=True nao acha o shim .cmd do npm,
e mesmo apontando pro .cmd resolvido via shutil.which, a query GraphQL (cheia de `{`, `}`,
`$`) se perde na re-tokenizacao do cmd.exe por baixo do .cmd — a policy mais simples ja
falhava com "no JSON response". HTTP direto elimina o problema inteiro e de quebra fica
bem mais rapido (sem spawn de processo + reload de auth a cada chamada).
"""
import argparse, json, os, sys, time, urllib.error, urllib.request
from datetime import date

LOG = []
HERE = os.path.dirname(os.path.abspath(__file__))
PHASES = ("all", "1b", "2", "3", "4a", "4b", "4", "5", "6")

CLIENT_ID = "7e9cb568cfd431c538f36d1ad3f2b4f6"  # Shopify CLI Connector App
API_VERSION = "2025-07"
_TOKEN_CACHE = {}


def _config_paths():
    home = os.path.expanduser("~")
    appdata = os.environ.get("APPDATA") or os.path.join(home, "AppData", "Roaming")
    return [
        os.path.join(appdata, "shopify-cli-store-nodejs", "Config", "config.json"),
        os.path.join(appdata, "shopify-cli-store-nodejs", "config.json"),
        os.path.join(home, "Library", "Preferences", "shopify-cli-store-nodejs", "config.json"),
        os.path.join(home, ".config", "shopify-cli-store-nodejs", "config.json"),
    ]


def _token_em_profundidade(no, limite=6):
    """Acha o accessToken em qualquer profundidade da entrada do config do CLI."""
    fila = [(no, 0)]
    while fila:
        atual, prof = fila.pop(0)
        if not isinstance(atual, dict) or prof > limite:
            continue
        sessoes = atual.get("sessionsByUserId")
        if isinstance(sessoes, dict) and sessoes:
            sess = sessoes.get(atual.get("currentUserId")) or next(iter(sessoes.values()))
            if isinstance(sess, dict) and sess.get("accessToken"):
                return sess["accessToken"]
        if isinstance(atual.get("accessToken"), str):
            return atual["accessToken"]
        for v in atual.values():
            if isinstance(v, dict):
                fila.append((v, prof + 1))
    return None


def _token_da_loja(store):
    if store in _TOKEN_CACHE:
        return _TOKEN_CACHE[store]
    handle = store.replace(".myshopify.com", "")
    for p in _config_paths():
        try:
            with open(p, "r", encoding="utf-8") as f:
                cfg = json.load(f)
        except Exception:
            continue
        for chave in (f"{CLIENT_ID}::{handle}.myshopify.com", f"{CLIENT_ID}::{handle}"):
            entrada = cfg.get(chave)
            if not entrada:
                continue
            # A lib de config do CLI quebra o dominio por pontos, entao a entrada de
            # "sua-loja.myshopify.com" vira {"myshopify": {"com": {...}}} e o
            # sessionsByUserId fica DOIS niveis abaixo. Procurar em profundidade.
            tok = _token_em_profundidade(entrada)
            if tok:
                _TOKEN_CACHE[store] = tok
                return tok
    raise SystemExit(f"sem auth guardada para {handle}. Rode: shopify store auth --store {handle}.myshopify.com")


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--store", required=True)
    p.add_argument("--brand-name", required=True)
    p.add_argument("--support-email", required=True)
    p.add_argument("--brand-domain", default="")
    p.add_argument("--legal-entity", default="")
    p.add_argument("--address", default="")
    p.add_argument("--products", default="products")
    p.add_argument("--home-country", default="BR")
    p.add_argument("--processing-time", default="1 to 3 business days")
    p.add_argument("--delivery-domestic", default="3 to 7 business days")
    p.add_argument("--delivery-international", default="7 to 20 business days")
    p.add_argument("--return-window", default="30 days")
    p.add_argument("--refund-time", default="5 to 10 business days")
    p.add_argument("--phase", default="all", choices=PHASES,
                   help="1b=politicas, 2=menus, 3=idioma, 4a=mercados nomeados, "
                        "4b=mercado Worldwide, 4=4a+4b+moeda local, 5=frete, 6=verificacao, all=todas")
    p.add_argument("--dry-run", action="store_true",
                   help="mostra o que seria gravado e sai sem tocar na loja")
    return p.parse_args()


def gql(store, query, variables=None, mutation=False):
    token = _token_da_loja(store)
    url = f"https://{store}/admin/api/{API_VERSION}/graphql.json"
    payload = json.dumps({"query": query, "variables": variables or {}}).encode("utf-8")
    req = urllib.request.Request(url, data=payload, method="POST", headers={
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": token,
    })
    for tentativa in range(4):
        body = None
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                body = json.loads(r.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            texto = e.read().decode("utf-8", "ignore")
            try:
                body = json.loads(texto)
            except Exception:
                return {"_error": f"HTTP {e.code}: {texto[:300]}"}
        except Exception as e:
            if tentativa < 3:
                time.sleep(1.5 * (tentativa + 1))
                continue
            return {"_error": str(e)}
        if body.get("errors"):
            msgs = [er.get("message", "") for er in body["errors"]]
            if any("throttl" in m.lower() for m in msgs) and tentativa < 3:
                time.sleep(2 * (tentativa + 1))
                continue
            return {"_error": " | ".join(msgs)}
        return body
    return {"_error": "falha após retries"}


def data_of(res, key):
    """Extrai o payload de uma mutation/query, tolerando as duas formas de retorno do CLI."""
    return res.get("data", {}).get(key, {}) or res.get(key, {}) or {}


def log(phase, status, detail=""):
    msg = f"[{status}] {phase} — {detail}" if detail else f"[{status}] {phase}"
    print(msg, flush=True)
    LOG.append({"phase": phase, "status": status, "detail": detail})


# ======================================================================
# FASE 1 — Políticas (fonte única: policy_templates.json, v5.5)
# ======================================================================

def _build_policies(brand, support, entity, domain, address, a):
    tpl = json.load(open(os.path.join(HERE, "policy_templates.json"), encoding="utf-8"))
    fallback_domain = a.store if ".myshopify.com" in a.store else f"{a.store}.myshopify.com"
    tokens = {
        "{{STORE_NAME}}": brand,
        "{{LEGAL_NAME}}": entity or brand,
        "{{COUNTRY}}": "Worldwide",
        "{{PRIVACY_EMAIL}}": support,
        "{{SUPPORT_EMAIL}}": support,
        # domain vem de --brand-domain (custom domain, quando já comprado). Loja nova
        # ainda sem domínio próprio caía em string vazia aqui, quebrando o texto da
        # política ("published at .", "when you visit ,") — ver memória
        # shopify-worldwide-setup-empty-domain-placeholder. Fallback pro myshopify.com
        # real da loja até o domínio custom ser conectado.
        "{{WEBSITE_URL}}": domain or fallback_domain,
        "{{EFFECTIVE_DATE}}": date.today().isoformat(),
        "{{PROCESSING_TIME}}": a.processing_time,
        "{{DOMESTIC_SHIPPING_TIME}}": a.delivery_domestic,
        "{{INTERNATIONAL_SHIPPING_TIME}}": a.delivery_international,
        "{{RETURN_WINDOW}}": a.return_window,
        "{{REFUND_TIME}}": a.refund_time,
    }
    out = {}
    for ptype, body in tpl.items():
        for tok, val in tokens.items():
            body = body.replace(tok, val)
        out[ptype] = body

    entity_block = f"<p>{entity}</p>" if entity else ""
    address_block = f"<p>Registered address: {address}</p>" if address else ""
    out["CONTACT_INFORMATION"] = f"""<h2>Contact Information</h2>
<p>We'd love to hear from you. Reach our customer support team using the channels below.</p>
<h3>Email</h3>
<p><a href="mailto:{support}">{support}</a></p>
<h3>Response Time</h3>
<p>We aim to reply within <strong>24 business hours</strong>, Monday through Friday.</p>
<h3>Business Name</h3>
<p>{brand}</p>
{entity_block}
{address_block}
<h3>Customer Support Topics</h3>
<ul>
<li>Order status and tracking</li>
<li>Returns and refunds</li>
<li>Product questions</li>
<li>Shipping inquiries</li>
<li>Account and billing</li>
</ul>"""
    return out


def phase_1b(store, policies):
    print("\n=== FASE 1B — Políticas (shopPolicyUpdate) ===")
    query = """
mutation($shopPolicy: ShopPolicyInput!) {
  shopPolicyUpdate(shopPolicy: $shopPolicy) {
    shopPolicy { id type }
    userErrors { field message }
  }
}
"""
    for ptype, body in policies.items():
        result = gql(store, query, {"shopPolicy": {"type": ptype, "body": body}}, mutation=True)
        if "_error" in result:
            log(f"1B/{ptype}", "ERROR", result["_error"])
            continue
        data = data_of(result, "shopPolicyUpdate")
        errs = data.get("userErrors", [])
        if errs:
            log(f"1B/{ptype}", "ERROR", errs[0].get("message", ""))
        else:
            log(f"1B/{ptype}", "OK")


# ======================================================================
# FASE 2 — Menus
# ======================================================================

def phase_2_menus(store):
    print("\n=== FASE 2 — Menus ===")
    q_list = "{ menus(first: 50) { nodes { id handle title items { id title type url } } } }"
    res = gql(store, q_list)
    nodes = data_of(res, "menus").get("nodes", [])
    existing = {n["handle"]: n for n in nodes}

    footer_items = [
        {"title": "Privacy Policy", "type": "HTTP", "url": "/policies/privacy-policy"},
        {"title": "Refund Policy", "type": "HTTP", "url": "/policies/refund-policy"},
        {"title": "Shipping Policy", "type": "HTTP", "url": "/policies/shipping-policy"},
        {"title": "Terms of Service", "type": "HTTP", "url": "/policies/terms-of-service"},
        {"title": "Contact", "type": "HTTP", "url": "/policies/contact-information"},
    ]
    main_items = [
        {"title": "Home", "type": "HTTP", "url": "/"},
        {"title": "Catalog", "type": "HTTP", "url": "/collections/all"},
        {"title": "Track Order", "type": "HTTP", "url": "/account"},
        {"title": "Contact", "type": "HTTP", "url": "/policies/contact-information"},
    ]

    for handle, title, items in [("footer", "Footer", footer_items), ("main-menu", "Main menu", main_items)]:
        if handle in existing:
            mut = """
mutation($id:ID!,$title:String!,$items:[MenuItemUpdateInput!]!){
  menuUpdate(id:$id,title:$title,items:$items){ menu{id handle} userErrors{field message} }
}
"""
            result = gql(store, mut, {"id": existing[handle]["id"], "title": title, "items": items}, mutation=True)
            data = data_of(result, "menuUpdate")
        else:
            mut = """
mutation($handle:String!,$title:String!,$items:[MenuItemCreateInput!]!){
  menuCreate(handle:$handle,title:$title,items:$items){ menu{id handle} userErrors{field message} }
}
"""
            result = gql(store, mut, {"handle": handle, "title": title, "items": items}, mutation=True)
            data = data_of(result, "menuCreate")
        if "_error" in result:
            log(f"2/{handle}", "ERROR", result["_error"])
            continue
        errs = data.get("userErrors", []) if data else []
        if errs:
            log(f"2/{handle}", "ERROR", errs[0].get("message", ""))
        else:
            log(f"2/{handle}", "OK")


# ======================================================================
# FASE 3A-B — Idioma English (habilitar + publicar; 3C default é só Chrome/UI)
# ======================================================================

def phase_3(store):
    print("\n=== FASE 3A-B — Idioma English ===")
    enable_q = """
mutation($locale:String!){
  shopLocaleEnable(locale:$locale){
    shopLocale{locale primary}
    userErrors{field message}
  }
}
"""
    res = gql(store, enable_q, {"locale": "en"}, mutation=True)
    data = data_of(res, "shopLocaleEnable")
    if "_error" in res:
        msg = res["_error"]
        log("3A/enable-en", "SKIPPED" if ("already" in msg.lower() or "exists" in msg.lower()) else "ERROR", msg)
    else:
        errs = data.get("userErrors", [])
        if errs:
            msg = errs[0].get("message", "")
            log("3A/enable-en", "SKIPPED" if "already" in msg.lower() else "ERROR", msg)
        else:
            log("3A/enable-en", "OK")

    pub_q = """
mutation($locale:String!){
  shopLocaleUpdate(locale:$locale, shopLocale:{published:true}){
    shopLocale{locale published}
    userErrors{field message}
  }
}
"""
    res = gql(store, pub_q, {"locale": "en"}, mutation=True)
    data = data_of(res, "shopLocaleUpdate")
    if "_error" in res:
        msg = res["_error"]
        log("3B/publish-en", "SKIPPED" if ("principal" in msg.lower() or "primary" in msg.lower()) else "ERROR", msg)
    else:
        errs = data.get("userErrors", [])
        if errs:
            log("3B/publish-en", "ERROR", errs[0].get("message", ""))
        else:
            log("3B/publish-en", "OK")


# ======================================================================
# FASE 4 — Mercados (API de Mercados Unificados: conditions.regionsCondition)
# ======================================================================

# Lista de "banidos"/não-alocáveis pro Worldwide catch-all (sanção + territórios sem
# alocação própria). AQ (Antártida) nem existe no enum CountryCode — fica de fora sozinho.
BANIDOS = {"CU", "IR", "KP", "SY", "BV", "HM", "AN", "ZZ", "TF"}

EUROZONE = ["DE", "FR", "IT", "ES", "PT", "NL", "BE", "AT", "IE", "FI", "GR", "LU", "MT", "SK", "SI", "EE", "LV", "LT", "CY", "HR"]
UK = ["GB"]
NORTH_AMERICA = ["US", "CA"]
REST_EUROPE = ["DK", "NO", "CZ", "HU", "RO", "BG", "IS"]

# (nome, países, moeda tentada — cai pra "sem moeda dedicada" se a loja não tiver
# Shopify Payments/plano pago; ver _criar_mercado)
MERCADOS_NOMEADOS = [
    # Sem mercado "Eurozone" (Lucas, 07/11/2026): repetia 20 países que já têm mercado próprio.
    # EUROZONE segue como lista de referência; esses países caem no catch-all da fase 4B se não tiverem mercado.
    ("United Kingdom", UK, "GBP"),
    ("Switzerland", ["CH"], "CHF"),
    ("Poland", ["PL"], "PLN"),
    ("Sweden", ["SE"], "SEK"),
    ("North America", NORTH_AMERICA, "USD"),
    ("Rest of Europe", REST_EUROPE, "EUR"),
]


def todos_os_paises(store):
    """Lê o enum CountryCode direto do schema em vez de confiar numa lista hardcoded
    que fica velha sempre que a Shopify adiciona/remove país alocável."""
    r = gql(store, '{ __type(name:"CountryCode"){ enumValues{ name } } }')
    if "_error" in r:
        raise SystemExit(f"não consegui ler o enum CountryCode: {r['_error']}")
    return {e["name"] for e in data_of(r, "__type").get("enumValues", [])}


def _criar_mercado(store, name, countries, currency=None):
    # RegionsCondition é oneOf: só um campo pode vir preenchido por vez (regions OU
    # regionIds OU applicationLevel) — combinar "regions" com "applicationLevel" quebra.
    conditions = {"regionsCondition": {"regions": [{"countryCode": c} for c in countries]}}
    mut = """
mutation($input:MarketCreateInput!){
  marketCreate(input:$input){
    market{ id name }
    userErrors{ field message }
  }
}
"""
    if currency:
        res = gql(store, mut, {"input": {"name": name, "conditions": conditions, "currencySettings": {"baseCurrency": currency}}}, mutation=True)
        errs = data_of(res, "marketCreate").get("userErrors", []) if "_error" not in res else [{"message": res["_error"]}]
        if not errs:
            return data_of(res, "marketCreate")["market"]["id"], currency
        # Trial/Basic sem Shopify Payments: currencySettings falha -> tenta sem moeda dedicada
    res = gql(store, mut, {"input": {"name": name, "conditions": conditions}}, mutation=True)
    if "_error" in res:
        return None, res["_error"]
    data = data_of(res, "marketCreate")
    errs = data.get("userErrors", [])
    if errs:
        return None, errs[0].get("message", "")
    return data["market"]["id"], None


def _add_regioes(store, market_id, countries):
    """marketRegionsCreate — usado pro que sobrar do lote de 100 do marketCreate inicial."""
    mut = """
mutation($marketId:ID!, $regions:[MarketRegionCreateInput!]!){
  marketRegionsCreate(marketId:$marketId, regions:$regions){
    userErrors{ field message }
  }
}
"""
    for i in range(0, len(countries), 100):
        lote = countries[i:i + 100]
        res = gql(store, mut, {"marketId": market_id, "regions": [{"countryCode": c} for c in lote]}, mutation=True)
        if "_error" in res:
            log("4B/lote", "ERROR", res["_error"])
            continue
        errs = data_of(res, "marketRegionsCreate").get("userErrors", [])
        if errs:
            log("4B/lote", "ERROR", errs[0].get("message", ""))


def phase_4a(store):
    print("\n=== FASE 4A — Mercados nomeados ===")
    ids = {}
    for name, countries, currency in MERCADOS_NOMEADOS:
        mid, resultado = _criar_mercado(store, name, countries, currency)
        if mid:
            ids[name] = mid
            moeda_txt = f"moeda {resultado}" if resultado else "sem moeda dedicada (loja sem Shopify Payments)"
            log(f"4A/{name}", "OK", f"{len(countries)} países, {moeda_txt}")
        else:
            log(f"4A/{name}", "ERROR", str(resultado))
    return ids


def phase_4b(store, home_country):
    print("\n=== FASE 4B — Worldwide catch-all (cobertura calculada do schema ao vivo) ===")
    todos = todos_os_paises(store)
    alocaveis = todos - BANIDOS
    nomeados = {c for _, cs, _ in MERCADOS_NOMEADOS for c in cs}
    gap = sorted(alocaveis - nomeados - {home_country})
    if not gap:
        log("4B/Worldwide", "SKIP", "nenhum país sobrando")
        return None
    primeiro, resto = gap[:100], gap[100:]
    mid, resultado = _criar_mercado(store, "Worldwide", primeiro)
    if not mid:
        log("4B/Worldwide", "ERROR", str(resultado))
        return None
    if resto:
        _add_regioes(store, mid, resto)
    cobertura = len(nomeados) + len(gap) + (1 if home_country in alocaveis else 0)
    log("4B/Worldwide", "OK", f"{len(gap)} países novos — cobertura {cobertura}/{len(alocaveis)}")
    return mid


def phase_4c_local_currencies(store, market_ids):
    print("\n=== FASE 4C — Moeda local em todo mercado não-primary ===")
    mut = """
mutation($id:ID!, $input:MarketUpdateInput!){
  marketUpdate(id:$id, input:$input){
    market{ id }
    userErrors{ field message }
  }
}
"""
    for name, mid in market_ids.items():
        if not mid:
            continue
        res = gql(store, mut, {"id": mid, "input": {"currencySettings": {"localCurrencies": True}}}, mutation=True)
        if "_error" in res:
            log(f"4C/{name}", "ERROR", res["_error"])
            continue
        errs = data_of(res, "marketUpdate").get("userErrors", [])
        if not errs:
            log(f"4C/{name}", "OK")
            continue
        msg = errs[0].get("message", "")
        # loja sem Shopify Payments ativo: multi-moeda não é possível ainda, não é bug.
        gateway_incompat = "gateway" in msg.lower() and "moeda" in msg.lower()
        log(f"4C/{name}", "SKIPPED" if gateway_incompat else "ERROR", msg)


# ======================================================================
# FASE 5 — Frete: layout fixo v5.4 (6 zonas, nomes no idioma local, SEM prazo)
# ======================================================================

# (nome da zona, países, nome da tarifa free, nome da tarifa premium, moeda, valor premium)
#
# PRESET v6 (2026-09-28) — 33 zonas dedicadas + Worldwide.
# Duas decisões que valem saber:
#  1. TRANSPORTADORA + IDIOMA LOCAL. Só a transportadora ("Poste Italiane Standard Shipping")
#     converte mais que o genérico, mas perde para o idioma local, que o preset v5.4 já tinha
#     em IT/DE/ES/FR. O v6 soma os dois. País multilíngue (CH, BE) e anglófono fica em inglês.
#  2. NOME REAL DO SERVIÇO. "USPS Ground Advantage" e "Royal Mail Tracked 48" são produtos que
#     existem; "First-Class Rushed" não. Nome inventado de serviço é o tipo de detalhe que o
#     comprador confere e derruba a confiança no passo mais caro do funil.
# Nenhuma tarifa informa prazo (regra NON-NEGOTIABLE). Standard sempre grátis; Premium 7.90.
ZONAS_FRETE = [
    # Eurozone
    ("Italy",        ["IT"], "Poste Italiane Consegna Standard Tracciata", "Poste Italiane Consegna Express Prioritaria (Premium)", "EUR", "7.90"),
    ("Germany",      ["DE"], "DHL Standardversand mit Sendungsverfolgung", "DHL Expressversand (Premium)", "EUR", "7.90"),
    ("Spain",        ["ES"], "Correos Envío Estándar Con Seguimiento", "Correos Envío Exprés Prioritario (Premium)", "EUR", "7.90"),
    ("France",       ["FR"], "La Poste Livraison standard suivie", "Chronopost Livraison express (Premium)", "EUR", "7.90"),
    ("Portugal",     ["PT"], "CTT Envio Standard com Seguimento", "CTT Envio Expresso (Premium)", "EUR", "7.90"),
    ("Netherlands",  ["NL"], "PostNL Standaardverzending", "PostNL Spoedverzending (Premium)", "EUR", "7.90"),
    ("Belgium",      ["BE"], "bpost Standard Shipping", "bpost Express Shipping (Premium)", "EUR", "7.90"),
    ("Austria",      ["AT"], "Österreichische Post Standardversand", "Österreichische Post Expressversand (Premium)", "EUR", "7.90"),
    ("Ireland",      ["IE"], "An Post Standard Post", "An Post Express Post (Premium)", "EUR", "7.90"),
    ("Finland",      ["FI"], "Posti Vakiotoimitus", "Posti Pikatoimitus (Premium)", "EUR", "7.90"),
    ("Greece",       ["GR"], "ELTA Hellenic Post Standard Shipping", "ELTA Courier Express (Premium)", "EUR", "7.90"),
    ("Slovenia",     ["SI"], "Pošta Slovenije Standardna dostava", "Pošta Slovenije Hitra dostava (Premium)", "EUR", "7.90"),
    ("Lithuania",    ["LT"], "Lietuvos Paštas Standartinis siuntimas", "Lietuvos Paštas Skubus siuntimas (Premium)", "EUR", "7.90"),
    ("Malta",        ["MT"], "MaltaPost Standard Shipping", "MaltaPost Express Mail Service (Premium)", "EUR", "7.90"),
    ("Cyprus",       ["CY"], "Cyprus Post Standard Shipping", "Cyprus Post Express Mail Service (Premium)", "EUR", "7.90"),
    # Europa fora do euro
    ("Switzerland",  ["CH"], "Swiss Post Economy Shipping", "Swiss Post Priority Shipping (Premium)", "EUR", "7.90"),
    ("Poland",       ["PL"], "Poczta Polska Przesyłka standardowa", "Poczta Polska Przesyłka ekspresowa (Premium)", "EUR", "7.90"),
    ("Sweden",       ["SE"], "PostNord Standardfrakt", "PostNord Expressfrakt (Premium)", "EUR", "7.90"),
    ("Denmark",      ["DK"], "PostNord Standardforsendelse", "PostNord Ekspresforsendelse (Premium)", "EUR", "7.90"),
    ("Norway",       ["NO"], "Posten Norge Standardforsendelse", "Posten Norge Ekspressforsendelse (Premium)", "EUR", "7.90"),
    # Américas
    ("United States",["US"], "USPS Ground Advantage", "USPS Priority Mail Express (Premium)", "EUR", "7.90"),
    ("Canada",       ["CA"], "Canada Post Regular Parcel", "Canada Post Xpresspost (Premium)", "EUR", "7.90"),
    ("Mexico",       ["MX"], "Correos de México Envío Estándar", "Estafeta Envío Exprés (Premium)", "EUR", "7.90"),
    ("Chile",        ["CL"], "Correos de Chile Envío Estándar", "Correos de Chile Envío Exprés (Premium)", "EUR", "7.90"),
    # Ásia-Pacífico
    ("Australia",    ["AU"], "Australia Post Standard Shipping", "Australia Post Express Post (Premium)", "EUR", "7.90"),
    ("New Zealand",  ["NZ"], "NZ Post Standard Shipping", "NZ Post Courier Express (Premium)", "EUR", "7.90"),
    ("Japan",        ["JP"], "Japan Post Standard Shipping", "Japan Post EMS (Premium)", "EUR", "7.90"),
    # Oriente Médio, Ásia Central e África
    ("United Arab Emirates", ["AE"], "Aramex Standard Shipping", "Aramex Express Shipping (Premium)", "EUR", "7.90"),
    ("Qatar",        ["QA"], "Qatar Post Standard Shipping", "Qatar Post Express Shipping (Premium)", "EUR", "7.90"),
    ("Saudi Arabia", ["SA"], "Saudi Post Standard Shipping", "Saudi Post EMS Express (Premium)", "EUR", "7.90"),
    ("Kazakhstan",   ["KZ"], "Kazpost Standard Shipping", "Kazpost Express Shipping (Premium)", "EUR", "7.90"),
    ("South Africa", ["ZA"], "South African Post Office Standard Shipping", "SAPO Speed Services Express (Premium)", "EUR", "7.90"),
]
UK_ZONA = ("United Kingdom", ["GB"], "Royal Mail Tracked Delivery", "Royal Mail Special Delivery (Premium)")
WORLDWIDE_ZONA = ("Worldwide", "Standard Tracked Delivery", "Priority Express Delivery (Premium)", "EUR", "7.90")


def _zona_input(nome, paises, m_free, m_prem, moeda, valor):
    return {
        "name": nome,
        "countries": [{"code": c, "includeAllProvinces": True} for c in paises],
        "methodDefinitionsToCreate": [
            {"name": m_free, "active": True, "rateDefinition": {"price": {"amount": "0", "currencyCode": moeda}}},
            {"name": m_prem, "active": True, "rateDefinition": {"price": {"amount": valor, "currencyCode": moeda}}},
        ],
    }


def _worldwide_input(moeda, valor):
    nome, m_free, m_prem, _, _ = WORLDWIDE_ZONA
    return {
        "name": nome,
        "countries": [{"restOfWorld": True}],
        "methodDefinitionsToCreate": [
            {"name": m_free, "active": True, "rateDefinition": {"price": {"amount": "0", "currencyCode": moeda}}},
            {"name": m_prem, "active": True, "rateDefinition": {"price": {"amount": valor, "currencyCode": moeda}}},
        ],
    }


def phase_5(store):
    print("\n=== FASE 5 — Frete (layout fixo v5.4: Italy/Germany/Spain/France/UK + Worldwide) ===")
    q = """
{
  deliveryProfiles(first:5){
    nodes{
      id name default
      profileLocationGroups{
        locationGroup{ id }
        locationGroupZones(first:50){
          nodes{
            zone{ id name }
            methodDefinitions(first:10){ nodes{ id name } }
          }
        }
      }
    }
  }
}
"""
    res = gql(store, q)
    if "_error" in res:
        log("5/inspect", "ERROR", res["_error"])
        return
    profiles = data_of(res, "deliveryProfiles").get("nodes", [])
    default_profile = next((p for p in profiles if p.get("default")), None)
    if not default_profile:
        log("5/inspect", "ERROR", "sem profile default")
        return
    lg = default_profile["profileLocationGroups"][0]
    lg_id = lg["locationGroup"]["id"]
    existing_zones = lg["locationGroupZones"]["nodes"]
    ja_existem = {z["zone"]["name"] for z in existing_zones}

    # zona legada da Shopify (normalmente "International") vira o catch-all novo — mas
    # v5.4 DELETA em vez de renomear (a Worldwide nasce zerada, sem herdar rate antigo).
    intl_zone = next((z for z in existing_zones if "international" in z["zone"]["name"].lower()), None)

    def montar_zonas(uk_moeda, uk_valor):
        zonas = [_zona_input(n, p, f, pr, m, v) for n, p, f, pr, m, v in ZONAS_FRETE if n not in ja_existem]
        uk_nome, uk_paises, uk_free, uk_prem = UK_ZONA
        if uk_nome not in ja_existem:
            zonas.append(_zona_input(uk_nome, uk_paises, uk_free, uk_prem, uk_moeda, uk_valor))
        if WORLDWIDE_ZONA[0] not in ja_existem:
            zonas.append(_worldwide_input(WORLDWIDE_ZONA[3], WORLDWIDE_ZONA[4]))
        return zonas

    profile_input = {"locationGroupsToUpdate": [{"id": lg_id}]}
    if intl_zone:
        profile_input["zonesToDelete"] = [intl_zone["zone"]["id"]]
        antigos = [m["id"] for m in intl_zone.get("methodDefinitions", {}).get("nodes", [])]
        if antigos:
            profile_input["methodDefinitionsToDelete"] = antigos

    # A moeda do UK e DECIDIDA, nao tentada. A Shopify ACEITA uma tarifa em GBP num
    # mercado que cobra em EUR, sem erro nenhum, e o cliente ve um valor quebrado no
    # checkout. O fallback por erro (abaixo) nunca dispara nesse caso. Entao perguntar
    # antes: so usa GBP se a loja realmente tem GBP habilitado.
    moedas = data_of(gql(store, "query{shop{enabledPresentmentCurrencies}}"), "shop").get("enabledPresentmentCurrencies") or []
    if "GBP" in moedas:
        uk_moeda, uk_valor = "GBP", "7.00"
    else:
        uk_moeda, uk_valor = "EUR", "7.90"
        log("5/uk-moeda", "OK", f"loja sem GBP habilitado ({', '.join(moedas) or 'nenhuma'}) — UK entra em EUR 7.90")
    zonas = montar_zonas(uk_moeda, uk_valor)
    if not zonas and "zonesToDelete" not in profile_input:
        log("5/apply", "OK", "nada a fazer, zonas já estavam no lugar")
        return
    profile_input["locationGroupsToUpdate"][0]["zonesToCreate"] = zonas

    mut = """
mutation($id:ID!, $profile:DeliveryProfileInput!){
  deliveryProfileUpdate(id:$id, profile:$profile){
    profile{id name}
    userErrors{field message}
  }
}
"""
    res = gql(store, mut, {"id": default_profile["id"], "profile": profile_input}, mutation=True)
    erro_moeda = False
    msg = ""
    if "_error" in res:
        msg = res["_error"]
        erro_moeda = "currency" in msg.lower() or "moeda" in msg.lower() or "gbp" in msg.lower()
    else:
        errs = data_of(res, "deliveryProfileUpdate").get("userErrors", [])
        if errs:
            msg = errs[0].get("message", "")
            erro_moeda = "currency" in msg.lower() or "moeda" in msg.lower() or "gbp" in msg.lower()
        else:
            log("5/apply", "OK", f"{len(zonas)} zonas criadas, zona legada removida={bool(intl_zone)}")
            return
    if not erro_moeda:
        log("5/apply", "ERROR", msg)
        return

    # fallback documentado: mercado UK sem GBP dedicado -> Premium entra em EUR 7.90
    log("5/apply", "RETRY", "GBP rejeitado (loja sem mercado UK em GBP) — tentando UK em EUR")
    zonas = montar_zonas("EUR", "7.90")
    profile_input["locationGroupsToUpdate"][0]["zonesToCreate"] = zonas
    res = gql(store, mut, {"id": default_profile["id"], "profile": profile_input}, mutation=True)
    if "_error" in res:
        log("5/apply", "ERROR", res["_error"])
        return
    errs = data_of(res, "deliveryProfileUpdate").get("userErrors", [])
    if errs:
        log("5/apply", "ERROR", errs[0].get("message", ""))
    else:
        log("5/apply", "OK", f"{len(zonas)} zonas criadas (UK em EUR), zona legada removida={bool(intl_zone)}")


# ======================================================================
# FASE 6 — Verificação 100/100/100 (v5.0)
# ======================================================================

def phase_6_verify(store, home_country):
    print("\n=== FASE 6 — Verificação ===")
    todos = todos_os_paises(store)
    alocaveis = todos - BANIDOS

    q_mkt = """
{
  markets(first:50){
    nodes{
      id name primary
      currencySettings{ localCurrencies }
      conditions{ regionsCondition{ regions(first:250){ nodes{ ... on MarketRegionCountry{ code } } } } }
    }
  }
}
"""
    res = gql(store, q_mkt)
    if "_error" in res:
        log("6/mercados", "ERROR", res["_error"])
    else:
        markets = data_of(res, "markets").get("nodes", [])
        cobertos = set()
        sem_moeda_local = []
        for m in markets:
            regs = (m.get("conditions", {}).get("regionsCondition") or {}).get("regions", {}).get("nodes", [])
            for r in regs:
                if r.get("code"):
                    cobertos.add(r["code"])
            if not m["primary"] and not (m.get("currencySettings") or {}).get("localCurrencies"):
                sem_moeda_local.append(m["name"])
        faltando = sorted(alocaveis - cobertos)
        if faltando:
            log("6/cobertura", "ERROR", f"{len(faltando)}/{len(alocaveis)} países sem mercado: {', '.join(faltando[:15])}{'...' if len(faltando) > 15 else ''}")
        else:
            log("6/cobertura", "OK", f"{len(cobertos)}/{len(alocaveis)} países cobertos")
        if sem_moeda_local:
            log("6/moeda-local", "ERROR", f"sem localCurrencies: {', '.join(sem_moeda_local)}")
        else:
            log("6/moeda-local", "OK", "localCurrencies ligado em todo mercado não-primary")

    q_ship = """
{
  deliveryProfiles(first:5){
    nodes{ default profileLocationGroups{ locationGroupZones(first:50){ nodes{ zone{ name countries{ code{ restOfWorld } } } } } } }
  }
}
"""
    res = gql(store, q_ship)
    if "_error" in res:
        log("6/frete-catchall", "ERROR", res["_error"])
        return
    profiles = data_of(res, "deliveryProfiles").get("nodes", [])
    default_profile = next((p for p in profiles if p.get("default")), None)
    zonas = default_profile["profileLocationGroups"][0]["locationGroupZones"]["nodes"] if default_profile else []
    tem_catchall = any(any(c.get("code", {}).get("restOfWorld") for c in z["zone"].get("countries", [])) for z in zonas)
    log("6/frete-catchall", "OK" if tem_catchall else "ERROR", "zona restOfWorld presente" if tem_catchall else "nenhuma zona restOfWorld encontrada")


def mostrar_plano(a):
    print("=== DRY-RUN — nada foi gravado na loja ===")
    print(f"loja      : {a.store}")
    print(f"marca     : {a.brand_name}")
    print(f"fase      : {a.phase}")
    print(f"pais base : {a.home_country}")
    print("\nMercados nomeados (fase 4A):")
    for nome, paises, moeda in MERCADOS_NOMEADOS:
        print(f"  {nome:<18} {len(paises):>3} países  moeda tentada: {moeda}")
    print("\nWorldwide (fase 4B): calculado ao vivo = 236 países alocáveis (schema) menos os nomeados menos o país base.")
    print("Moeda local (fase 4C): localCurrencies=true em todo mercado não-primary.")
    print("\nZonas de frete (fase 5):")
    for nome, paises, free, prem, moeda, valor in ZONAS_FRETE:
        print(f"  {nome:<15} {free} (Free) / {prem} ({moeda} {valor})")
    uk_nome, uk_paises, uk_free, uk_prem = UK_ZONA
    print(f"  {uk_nome:<15} {uk_free} (Free) / {uk_prem} (GBP 7.00, fallback EUR 7.90)")
    print(f"  {'Worldwide':<15} restOfWorld:true — {WORLDWIDE_ZONA[1]} (Free) / {WORLDWIDE_ZONA[2]} (EUR 7.90)")
    print("\nNenhuma tarifa leva prazo (regra NON-NEGOTIABLE v5.2). Transit time = Nenhum.")


if __name__ == "__main__":
    a = parse_args()
    if a.dry_run:
        mostrar_plano(a)
        sys.exit(0)
    policies = _build_policies(a.brand_name, a.support_email, a.legal_entity, a.brand_domain, a.address, a)
    phase = a.phase
    market_ids = {}
    if phase in ("all", "1b"):
        phase_1b(a.store, policies)
    if phase in ("all", "2"):
        phase_2_menus(a.store)
    if phase in ("all", "3"):
        phase_3(a.store)
    if phase in ("all", "4a", "4"):
        market_ids = phase_4a(a.store)
    if phase in ("all", "4b", "4"):
        ww_id = phase_4b(a.store, a.home_country)
        if ww_id:
            market_ids["Worldwide"] = ww_id
    if phase in ("all", "4") and market_ids:
        phase_4c_local_currencies(a.store, market_ids)
    if phase in ("all", "5"):
        phase_5(a.store)
    if phase in ("all", "6"):
        phase_6_verify(a.store, a.home_country)
    print("\n=== RESUMO ===")
    print(json.dumps(LOG, indent=2, ensure_ascii=False))
    out = os.path.join(HERE, "log.json")
    with open(out, "w", encoding="utf-8") as f:
        json.dump(LOG, f, indent=2, ensure_ascii=False)
