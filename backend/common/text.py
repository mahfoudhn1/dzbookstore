"""Text normalisation for Arabic / French / English book search.

Algerian bookshops receive queries in three scripts, often without the
diacritics or with the usual Arabic spelling variants (alef forms, ya/alef
maqsura, ta marbuta).  Storing a folded form next to every searchable title
and folding the incoming query makes those variants match each other.
"""
import re
import unicodedata

# Tashkeel (harakat), Quranic marks and the tatweel letter.
_ARABIC_MARKS = re.compile(r"[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u0640]")
# Arabic-indic digits -> latin digits.
_ARABIC_DIGITS = str.maketrans("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹", "01234567890123456789")
_NON_WORD = re.compile(r"[^\w\u0600-\u06FF]+", re.UNICODE)

_ARABIC_FOLDS = {
    "أ": "ا",
    "إ": "ا",
    "آ": "ا",
    "ٱ": "ا",
    "ى": "ي",
    "ئ": "ي",
    "ؤ": "و",
    "ة": "ه",
}


def strip_diacritics(text: str) -> str:
    """Remove Arabic vowel marks, tatweel and latin combining accents."""
    if not text:
        return ""
    text = _ARABIC_MARKS.sub("", text)
    decomposed = unicodedata.normalize("NFKD", text)
    return "".join(ch for ch in decomposed if not unicodedata.combining(ch))


def normalize_arabic(text: str) -> str:
    """Fold the common Arabic spelling variants into one canonical form."""
    text = strip_diacritics(text or "")
    for source, target in _ARABIC_FOLDS.items():
        text = text.replace(source, target)
    return text


def normalize(text: str) -> str:
    """Return the folded, lower-cased, whitespace-collapsed search form."""
    text = normalize_arabic(text or "").translate(_ARABIC_DIGITS).lower()
    text = _NON_WORD.sub(" ", text)
    return " ".join(text.split())


# Kept as an alias because the name reads better at call sites that deal with
# titles only.
normalize_title = normalize


def tokens(text: str) -> list[str]:
    return [token for token in normalize(text).split(" ") if token]


def isbn_digits(value: str) -> str:
    """Keep only ISBN characters so '978-9961-89-281-3' matches storage."""
    return re.sub(r"[^0-9Xx]", "", value or "").upper()


_LATIN_TO_ARABIC = (
    ("kh", "خ"),
    ("ch", "ش"),
    ("gh", "غ"),
    ("th", "ث"),
    ("dh", "ذ"),
    ("sh", "ش"),
    ("ou", "و"),
    ("ou", "و"),
    ("aa", "ا"),
    ("ee", "ي"),
    ("ii", "ي"),
    ("a", "ا"),
    ("b", "ب"),
    ("t", "ت"),
    ("d", "د"),
    ("r", "ر"),
    ("z", "ز"),
    ("s", "س"),
    ("f", "ف"),
    ("q", "ق"),
    ("k", "ك"),
    ("l", "ل"),
    ("m", "م"),
    ("n", "ن"),
    ("h", "ه"),
    ("w", "و"),
    ("y", "ي"),
    ("j", "ج"),
    ("p", "ب"),
    ("v", "ف"),
    ("e", "ي"),
    ("o", "و"),
    ("u", "و"),
    ("i", "ي"),
)


def transliterate_latin_to_arabic(text: str) -> str:
    """Best-effort Arabic rendering of a latin transliteration (e.g. 'najma').

    This is deliberately approximate: it is only used to add candidate terms
    to a search, never to overwrite the user's query.
    """
    lowered = normalize(text)
    result = []
    index = 0
    while index < len(lowered):
        for latin, arabic in _LATIN_TO_ARABIC:
            if lowered.startswith(latin, index):
                result.append(arabic)
                index += len(latin)
                break
        else:
            char = lowered[index]
            result.append(char if not char.isalpha() else "")
            index += 1
    return "".join(result)


def search_variants(query: str) -> list[str]:
    """Return folded variants worth trying for a query (original first)."""
    folded = normalize(query)
    variants = [folded]
    transliterated = transliterate_latin_to_arabic(query)
    if transliterated and transliterated not in variants:
        variants.append(transliterated)
    # Drop the definite article so "al" / "el" prefixes behave like French
    # catalogues do.  Only used as an extra match, never as a replacement.
    for variant in list(variants):
        if variant.startswith("ال") and len(variant) > 4:
            variants.append(variant[2:])
        if variant.startswith("el ") or variant.startswith("al "):
            variants.append(variant[3:])
    # Preserve order while removing empty/duplicate candidates.
    seen = set()
    cleaned = []
    for variant in variants:
        variant = variant.strip()
        if variant and variant not in seen:
            seen.add(variant)
            cleaned.append(variant)
    return cleaned


def similarity(left: str, right: str) -> float:
    """Similarity ratio between two folded strings, used for typo tolerance."""
    from difflib import SequenceMatcher

    left, right = normalize(left), normalize(right)
    if not left or not right:
        return 0.0
    if left == right:
        return 1.0
    return SequenceMatcher(None, left, right).ratio()


def is_typo_match(query: str, candidate: str, threshold: float = 0.78) -> bool:
    """True when the whole query or every word of it looks like a typo match."""
    if not query or not candidate:
        return False
    if query in candidate:
        return True
    if similarity(query, candidate) >= threshold:
        return True
    query_tokens = tokens(query)
    if not query_tokens:
        return False
    candidate_tokens = tokens(candidate)
    for needle in query_tokens:
        if len(needle) < 3:
            if needle not in candidate:
                return False
            continue
        if not any(similarity(needle, token) >= threshold for token in candidate_tokens):
            return False
    return True


def truncate(text: str, length: int = 280) -> str:
    text = (text or "").strip()
    return text if len(text) <= length else text[: length - 1].rstrip() + "…"
