"""Every outbound link in the app, checked against the live web.

REPORTED: "The TIJ datasheet link is taking me to the product page instead of the
datasheet... Same issue with a lot of the datasheet links." A link that 404s is
obvious; a link that returns 200 and is the wrong document is not, which is why this
prints what came back — the content type and the server's own filename — rather than
just a status.

Run it after changing any of the link data. It touches axim.example and two vendor
sites, so it is not part of the test suite: the tests must pass on a train.

    python data/check_links.py
"""
from __future__ import annotations

import pathlib
import re
import sys
import time
import urllib.error
import urllib.request

HERE = pathlib.Path(__file__).parent
SRC = HERE.parent / "web" / "src"
UA = "Mozilla/5.0 (compatible; AximQuote/1.0; +internal link check)"
# Parentheses are part of at least one real URL here — axim.example has a path
# segment reading "(cij)" — so they cannot simply be excluded, and a trailing one is
# usually the code's own bracket. Matched greedily, then unbalanced tails trimmed.
URL = re.compile(r"https://[^\"'\s]+")


def trim(u: str) -> str:
    while u and u[-1] in ".,;:)\"'`":
        if u[-1] == ")" and u.count("(") >= u.count(")"):
            break
        u = u[:-1]
    return u


BROWSER = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
           "(KHTML, like Gecko) Chrome/120.0 Safari/537.36")


def head(url: str, agent: str = UA):
    req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": agent})
    try:
        with urllib.request.urlopen(req, timeout=45) as r:
            cd = r.headers.get("content-disposition", "")
            name = re.search(r'filename="?([^";]+)"?', cd)
            return (r.status,
                    (r.headers.get("content-type") or "").split(";")[0],
                    name.group(1).strip() if name else "")
    except urllib.error.HTTPError as e:
        return e.code, "", ""
    except Exception as e:  # noqa: BLE001
        return 0, str(e)[:40], ""


def main() -> int:
    urls = set()
    for f in list(SRC.rglob("*.ts")) + list(SRC.rglob("*.tsx")):
        for m in URL.finditer(f.read_text(encoding="utf-8")):
            urls.add(trim(m.group(0)))
    urls = sorted(urls)
    print(f"{len(urls)} distinct links\n")

    bad = 0
    # Stop leaning on a host that is already failing. On 20 August 2026 axim.example
    # started answering 500 to everything, including a plain browser GET on a page that
    # had been fine minutes earlier, and this script cheerfully asked it 128 more times.
    # Whether or not that was cause or coincidence, a checker should back off.
    from urllib.parse import urlparse
    streak: dict[str, int] = {}
    for u in urls:
        host = urlparse(u).netloc
        if streak.get(host, 0) >= 5:
            print(f".. --- {'':<26} skipped, {host} has failed 5 in a row")
            continue
        status, ctype, name = head(u)
        # Some hosts refuse a HEAD from an unfamiliar agent — axim.example answers
        # 403 to this script and 200 to a browser. Retry once before calling it broken,
        # so the check does not cry wolf on a link that works for every rep.
        if status != 200:
            status, ctype, name = head(u, BROWSER)
        flag = "  " if status == 200 else "!!"
        if status == 200:
            streak[host] = 0
        else:
            streak[host] = streak.get(host, 0) + 1
            bad += 1
        print(f"{flag} {status:>3} {ctype:<26} {name or u[:70]}")
        if not name:
            print(f"        {u[:100]}")
        time.sleep(0.15)
    print(f"\n{len(urls) - bad} of {len(urls)} return 200")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
