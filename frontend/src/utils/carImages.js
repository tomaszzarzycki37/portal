const demoImageMap = {
  'BYD Seal': 'https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?auto=format&fit=crop&w=1200&q=80',
  'BYD Atto 3': 'https://images.unsplash.com/photo-1619767886558-efdc259cde1a?auto=format&fit=crop&w=1200&q=80',
  'Geely Coolray': 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=80',
  'Geely Emgrand': 'https://images.unsplash.com/photo-1494976388531-d1058494cdd8?auto=format&fit=crop&w=1200&q=80',
  'NIO ET5': 'https://images.unsplash.com/photo-1489824904134-891ab64532f1?auto=format&fit=crop&w=1200&q=80',
  'Chery Tiggo 8': 'https://images.unsplash.com/photo-1549924231-f129b911e442?auto=format&fit=crop&w=1200&q=80',
}

const genericCarImage =
  'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=1200&q=80'

export function getCarImage(car) {
  if (!car) return genericCarImage
  if (car.image) return car.image

  const key = `${car.brand_name || car.brand?.name || ''} ${car.name || ''}`.trim()
  return demoImageMap[key] || genericCarImage
}
