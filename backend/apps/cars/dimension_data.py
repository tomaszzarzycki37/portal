"""Official body dimensions (length x width x height in mm) for car models."""

# Keys are normalized model names (lowercase).
DIMENSIONS_BY_NAME = {
    'atto 3': (4455, 1875, 1615),
    'seal': (4800, 1875, 1460),
    'tang': (4970, 1955, 1745),
    'et5': (4790, 1960, 1499),
    'el6': (4912, 1987, 1720),
    'p7': (4888, 1896, 1450),
    'g9': (4891, 1937, 1680),
    'l9': (5218, 1998, 1800),
    'l7': (5050, 1995, 1750),
    'h6': (4703, 1886, 1730),
    'jolion': (4472, 1874, 1626),
    'mg4 electric': (4287, 1836, 1504),
    'zs ev': (4323, 1809, 1649),
    'emgrand': (4638, 1822, 1460),
    'galaxy l7': (4710, 1905, 1685),
    'tiggo 8 pro': (4720, 1860, 1705),
    'tiggo 8': (4700, 1860, 1705),
    'omoda 5': (4374, 1830, 1588),
    'aion s': (4768, 1880, 1530),
    'aion v': (4586, 1854, 1680),
    'cs75 plus': (4690, 1865, 1710),
    'deepal s7': (4750, 1930, 1625),
    'coolray': (4330, 1830, 1609),
}

# Legacy slug aliases used in seed data.
DIMENSIONS_BY_SLUG = {
    slug.replace(' ', '-'): values
    for slug, values in (
        ('atto-3', DIMENSIONS_BY_NAME['atto 3']),
        ('seal', DIMENSIONS_BY_NAME['seal']),
        ('tang', DIMENSIONS_BY_NAME['tang']),
        ('et5', DIMENSIONS_BY_NAME['et5']),
        ('el6', DIMENSIONS_BY_NAME['el6']),
        ('p7', DIMENSIONS_BY_NAME['p7']),
        ('g9', DIMENSIONS_BY_NAME['g9']),
        ('l9', DIMENSIONS_BY_NAME['l9']),
        ('l7', DIMENSIONS_BY_NAME['l7']),
        ('h6', DIMENSIONS_BY_NAME['h6']),
        ('jolion', DIMENSIONS_BY_NAME['jolion']),
        ('mg4-electric', DIMENSIONS_BY_NAME['mg4 electric']),
        ('zs-ev', DIMENSIONS_BY_NAME['zs ev']),
        ('emgrand', DIMENSIONS_BY_NAME['emgrand']),
        ('galaxy-l7', DIMENSIONS_BY_NAME['galaxy l7']),
        ('tiggo-8-pro', DIMENSIONS_BY_NAME['tiggo 8 pro']),
        ('omoda-5', DIMENSIONS_BY_NAME['omoda 5']),
        ('aion-s', DIMENSIONS_BY_NAME['aion s']),
        ('aion-v', DIMENSIONS_BY_NAME['aion v']),
        ('cs75-plus', DIMENSIONS_BY_NAME['cs75 plus']),
        ('deepal-s7', DIMENSIONS_BY_NAME['deepal s7']),
    )
}


def normalize_model_name(name):
    return ' '.join((name or '').lower().replace('-', ' ').split())


def get_dimensions_for_model(*, slug='', name=''):
    if slug in DIMENSIONS_BY_SLUG:
        return DIMENSIONS_BY_SLUG[slug]
    normalized = normalize_model_name(name)
    return DIMENSIONS_BY_NAME.get(normalized)
