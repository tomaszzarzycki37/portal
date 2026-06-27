"""Detailed opinion rating schema (sections + keys)."""

RATING_MIN = 1
RATING_MAX = 5

RATING_SECTIONS = {
    'technical': [
        'engine',
        'gearbox',
        'drivetrain',
        'suspension',
        'bodywork',
        'paint',
        'anti_corrosion',
    ],
    'comfort': [
        'soundproofing',
        'hvac',
        'ergonomics',
        'multimedia',
        'materials',
        'passenger_space',
        'cargo_space',
    ],
    'utility': [
        'visibility',
        'driving_position',
        'handling',
        'safety_systems',
        'exterior_lighting',
        'performance',
        'functionality',
    ],
    'economy': [
        'value_for_money',
        'reliability',
        'trouble_free',
        'service_conditions',
        'maintenance_ease',
    ],
}

ALL_RATING_KEYS = [
    key for keys in RATING_SECTIONS.values() for key in keys
]


def empty_detailed_ratings():
    return {
        section: {key: RATING_MAX for key in keys}
        for section, keys in RATING_SECTIONS.items()
    }


def _section_average(section_values):
    values = [int(v) for v in section_values.values() if v is not None]
    if not values:
        return RATING_MAX
    return round(sum(values) / len(values))


def sync_legacy_ratings_from_detailed(detailed_ratings):
    """Map detailed sections onto legacy 8 fields for aggregates."""
    technical = detailed_ratings.get('technical', {})
    comfort = detailed_ratings.get('comfort', {})
    utility = detailed_ratings.get('utility', {})
    economy = detailed_ratings.get('economy', {})

    return {
        'rating_quality': _section_average({
            'bodywork': technical.get('bodywork'),
            'paint': technical.get('paint'),
            'materials': comfort.get('materials'),
        }),
        'rating_workmanship': _section_average({
            'engine': technical.get('engine'),
            'gearbox': technical.get('gearbox'),
            'anti_corrosion': technical.get('anti_corrosion'),
        }),
        'rating_economy': _section_average(economy),
        'rating_safety': int(utility.get('safety_systems') or RATING_MAX),
        'rating_comfort': _section_average(comfort),
        'rating_performance': int(utility.get('performance') or RATING_MAX),
        'rating_design': _section_average({
            'bodywork': technical.get('bodywork'),
            'paint': technical.get('paint'),
            'materials': comfort.get('materials'),
        }),
        'rating_reliability': int(economy.get('reliability') or RATING_MAX),
    }


def migrate_legacy_to_detailed(opinion):
    """Best-effort mapping from legacy 8 fields to detailed schema."""
    detailed = empty_detailed_ratings()
    q = opinion.rating_quality
    w = opinion.rating_workmanship
    e = opinion.rating_economy
    s = opinion.rating_safety
    c = opinion.rating_comfort
    p = opinion.rating_performance
    d = opinion.rating_design
    r = opinion.rating_reliability

    detailed['technical']['engine'] = w
    detailed['technical']['gearbox'] = w
    detailed['technical']['drivetrain'] = w
    detailed['technical']['suspension'] = w
    detailed['technical']['bodywork'] = q
    detailed['technical']['paint'] = d
    detailed['technical']['anti_corrosion'] = w

    detailed['comfort']['soundproofing'] = c
    detailed['comfort']['hvac'] = c
    detailed['comfort']['ergonomics'] = c
    detailed['comfort']['multimedia'] = c
    detailed['comfort']['materials'] = q
    detailed['comfort']['passenger_space'] = c
    detailed['comfort']['cargo_space'] = c

    detailed['utility']['visibility'] = s
    detailed['utility']['driving_position'] = c
    detailed['utility']['handling'] = p
    detailed['utility']['safety_systems'] = s
    detailed['utility']['exterior_lighting'] = s
    detailed['utility']['performance'] = p
    detailed['utility']['functionality'] = q

    detailed['economy']['value_for_money'] = e
    detailed['economy']['reliability'] = r
    detailed['economy']['trouble_free'] = r
    detailed['economy']['service_conditions'] = e
    detailed['economy']['maintenance_ease'] = e

    return detailed


def validate_detailed_ratings(raw):
    if not isinstance(raw, dict):
        raise ValueError('detailed_ratings must be an object')

    normalized = empty_detailed_ratings()
    for section, keys in RATING_SECTIONS.items():
        section_data = raw.get(section)
        if not isinstance(section_data, dict):
            raise ValueError(f'detailed_ratings.{section} must be an object')
        for key in keys:
            value = section_data.get(key)
            try:
                numeric = int(value)
            except (TypeError, ValueError):
                raise ValueError(f'detailed_ratings.{section}.{key} must be an integer')
            if numeric < RATING_MIN or numeric > RATING_MAX:
                raise ValueError(
                    f'detailed_ratings.{section}.{key} must be between {RATING_MIN} and {RATING_MAX}'
                )
            normalized[section][key] = numeric
    return normalized


def flatten_detailed_ratings(detailed_ratings):
    values = []
    for section, keys in RATING_SECTIONS.items():
        section_data = detailed_ratings.get(section) or {}
        for key in keys:
            value = section_data.get(key)
            if value is not None:
                values.append(int(value))
    return values
