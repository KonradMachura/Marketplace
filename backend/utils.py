CATEGORIES = [
    'Electronics',
    'Clothing & Apparel',
    'Vehicles',
    'Real Estate',
    'Home & Garden',
    'Sports & Outdoors',
    'Books & Media',
    'Toys & Games',
    'Art & Collectibles',
    'Other',
]

CONDITIONS = ['New', 'Like New', 'Good', 'Fair', 'Poor']
STATUSES   = ['Active', 'Reserved', 'Sold']

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp'}


def allowed_file(filename: str) -> bool:
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
