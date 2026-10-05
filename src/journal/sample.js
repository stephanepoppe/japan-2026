// ponytail: sample journal for the design pass; replaced by GET /api/journal once photos live in R2.
// Pretends it's 15 October, mid-Kyoto, so the route shows both travelled and upcoming legs.
const pic = (seed, w = 1600, h = 1067) => ({ url: `https://picsum.photos/seed/${seed}/${w}/${h}`, w, h })
const tall = seed => pic(seed, 1067, 1600)

export const SAMPLE = {
  now: '2026-10-15',
  days: [
    {
      day: '2026-10-07', city: 'Tokyo',
      moments: [
        { id: 'm1', time: '18:20', place: { name: 'Ryogoku, Tokyo', lat: 35.6967, lon: 139.7932 },
          text: 'Eerste kom chanko nabe, naast de sumohal. Na twaalf uur vliegen voelt dat als een warme deken.',
          photos: [pic('chanko-pot')], comments: [] },
      ],
    },
    {
      day: '2026-10-08', city: 'Tokyo',
      moments: [
        { id: 'm2', time: '10:40', place: { name: 'Mariposa, Shimokitazawa', lat: 35.6615, lon: 139.6680 },
          text: 'Koffie die tien minuten duurt om te zetten. Dat is hier net de bedoeling.',
          photos: [tall('kissaten-cup')], comments: [] },
        { id: 'm3', time: '12:30', place: { name: 'Disk Union, Shimokitazawa', lat: 35.6606, lon: 139.6676 },
          text: 'Twee uur in de bakken. Eén plaat mee, drie op het verlanglijstje.',
          photos: [pic('vinyl-bins'), tall('record-sleeve')],
          comments: [{ id: 'c1', name: 'Pieter', text: 'Welke plaat? Ik wil foto’s van de hoes.', at: '2026-10-08T14:02' }] },
      ],
    },
    {
      day: '2026-10-12', city: 'Hakone',
      moments: [
        { id: 'm4', time: '09:15', place: { name: 'Owakudani, Hakone', lat: 35.2440, lon: 139.0217 },
          text: 'Van Gora naar Owakudani te voet. Zwavelgeur, mist, en dan plots de Fuji.',
          photos: [pic('hakone-mist'), pic('sulfur-valley'), tall('fuji-glimpse')], comments: [] },
      ],
    },
    {
      day: '2026-10-15', city: 'Kyoto',
      moments: [
        { id: 'm5', time: '07:50', place: { name: 'Fushimi Inari, Kyoto', lat: 34.9671, lon: 135.7727 },
          text: 'Om acht uur ’s ochtends, nog voor de bussen. Duizend oranje poorten en alleen het geluid van onze stappen.',
          touristy: true,
          photos: [tall('torii-path'), pic('torii-light')],
          comments: [
            { id: 'c2', name: 'Oma & Opa', text: 'Wat een kleuren! Pas goed op jullie knieën op al die trappen.', at: '2026-10-15T09:12' },
            { id: 'c3', name: 'Lotte', text: 'Jaloers. Zo vroeg opstaan zou ik nooit doen, dus goed dat jullie het deden.', at: '2026-10-15T10:40' },
          ] },
        { id: 'm6', time: '11:30', place: { name: 'Rokuyosha, Kyoto', lat: 35.0089, lon: 135.7700 },
          text: 'Koffie en een donut in de kelder van Rokuyosha, open sinds 1950. Niemand heeft hier haast.',
          photos: [pic('basement-cafe')], comments: [] },
        { id: 'm7', time: '15:10', place: { name: 'Ichizawa Shinzaburo Hanpu, Kyoto', lat: 35.0035, lon: 135.7790 },
          text: 'Canvas tassen, met de hand genaaid in een atelier om de hoek. We kwamen buiten met twee.',
          photos: [tall('canvas-bags')],
          comments: [{ id: 'c4', name: 'Lotte', text: 'Die groene wil ik ook.', at: '2026-10-15T16:01' }] },
        { id: 'm8', time: '19:20', place: { name: 'Kamogawa, Kyoto', lat: 35.0050, lon: 135.7717 },
          text: 'Avondwandeling langs de Kamo. Iedereen zit hier gewoon op de oever, dus wij ook.',
          photos: [pic('river-dusk'), pic('river-steps'), pic('lanterns'), pic('bridge-night')], comments: [] },
      ],
    },
  ],
}
