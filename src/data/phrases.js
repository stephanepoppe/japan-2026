// Curated for this trip (Q5a): Japanese to show, romaji to say, English to find it by.
// Grouped by the situation you're standing in, not by grammar.
export const PHRASE_GROUPS = [
  {
    group: 'Basics',
    items: [
      { ja: 'すみません', romaji: 'Sumimasen', en: 'Excuse me / sorry (also: to get attention)' },
      { ja: 'ありがとうございます', romaji: 'Arigatō gozaimasu', en: 'Thank you' },
      { ja: 'お願いします', romaji: 'Onegai shimasu', en: 'Please (when asking for something)' },
      { ja: 'はい / いいえ', romaji: 'Hai / Iie', en: 'Yes / No' },
      { ja: '大丈夫です', romaji: 'Daijōbu desu', en: "It's fine / no thanks / I'm OK" },
      { ja: '英語を話せますか？', romaji: 'Eigo o hanasemasu ka?', en: 'Do you speak English?' },
      { ja: '日本語が話せません', romaji: 'Nihongo ga hanasemasen', en: "I don't speak Japanese" },
      { ja: 'わかりません', romaji: 'Wakarimasen', en: "I don't understand" },
    ],
  },
  {
    group: 'Trains & stations',
    items: [
      { ja: '〜はどこですか？', romaji: '… wa doko desu ka?', en: 'Where is …?' },
      { ja: '切符売り場はどこですか？', romaji: 'Kippu-uriba wa doko desu ka?', en: 'Where is the ticket office?' },
      { ja: 'この電車は〜に行きますか？', romaji: 'Kono densha wa … ni ikimasu ka?', en: 'Does this train go to …?' },
      { ja: '何番線ですか？', romaji: 'Nanbansen desu ka?', en: 'Which platform?' },
      { ja: '指定席です', romaji: 'Shiteiseki desu', en: 'I have a reserved seat' },
      { ja: 'この席は空いていますか？', romaji: 'Kono seki wa aite imasu ka?', en: 'Is this seat free?' },
      { ja: '乗り換えはどこですか？', romaji: 'Norikae wa doko desu ka?', en: 'Where do I change trains?' },
      { ja: 'コインロッカーはありますか？', romaji: 'Koin-rokkā wa arimasu ka?', en: 'Are there coin lockers?' },
    ],
  },
  {
    group: 'Restaurants',
    items: [
      { ja: '二人です', romaji: 'Futari desu', en: 'Table for two' },
      { ja: 'メニューをお願いします', romaji: 'Menyū o onegai shimasu', en: 'The menu, please' },
      { ja: 'おすすめは何ですか？', romaji: 'Osusume wa nan desu ka?', en: "What do you recommend?" },
      { ja: 'これをください', romaji: 'Kore o kudasai', en: "I'll have this (while pointing)" },
      { ja: '肉は食べられません', romaji: 'Niku wa taberaremasen', en: "I can't eat meat" },
      { ja: 'アレルギーがあります', romaji: 'Arerugī ga arimasu', en: 'I have an allergy' },
      { ja: 'お水をください', romaji: 'O-mizu o kudasai', en: 'Water, please' },
      { ja: 'お会計をお願いします', romaji: 'O-kaikei o onegai shimasu', en: 'The bill, please' },
      { ja: 'ごちそうさまでした', romaji: 'Gochisōsama deshita', en: 'Thank you for the meal (on leaving)' },
    ],
  },
  {
    group: 'Shops & konbini',
    items: [
      { ja: 'いくらですか？', romaji: 'Ikura desu ka?', en: 'How much is it?' },
      { ja: 'カードで払えますか？', romaji: 'Kādo de haraemasu ka?', en: 'Can I pay by card?' },
      { ja: '袋をください', romaji: 'Fukuro o kudasai', en: 'A bag, please' },
      { ja: '袋は大丈夫です', romaji: 'Fukuro wa daijōbu desu', en: "No bag, thanks" },
      { ja: '温めてください', romaji: 'Atatamete kudasai', en: 'Please heat it up' },
      { ja: '免税できますか？', romaji: 'Menzei dekimasu ka?', en: 'Can I get tax-free?' },
    ],
  },
  {
    group: 'Hotel & ryokan',
    items: [
      { ja: 'チェックインお願いします', romaji: 'Chekkuin onegai shimasu', en: "I'd like to check in" },
      { ja: '予約しています', romaji: 'Yoyaku shite imasu', en: 'I have a reservation' },
      { ja: '荷物を預かってもらえますか？', romaji: 'Nimotsu o azukatte moraemasu ka?', en: 'Can you store my luggage?' },
      { ja: '温泉は何時までですか？', romaji: 'Onsen wa nanji made desu ka?', en: 'Until what time is the onsen open?' },
      { ja: '朝食は何時からですか？', romaji: 'Chōshoku wa nanji kara desu ka?', en: 'What time is breakfast?' },
      { ja: 'Wi-Fiのパスワードを教えてください', romaji: 'Wi-Fi no pasuwādo o oshiete kudasai', en: 'Could I have the Wi-Fi password?' },
    ],
  },
  {
    group: 'Trouble',
    items: [
      { ja: '助けてください', romaji: 'Tasukete kudasai', en: 'Please help me' },
      { ja: '道に迷いました', romaji: 'Michi ni mayoimashita', en: "I'm lost" },
      { ja: '病院はどこですか？', romaji: 'Byōin wa doko desu ka?', en: 'Where is a hospital?' },
      { ja: '薬局を探しています', romaji: 'Yakkyoku o sagashite imasu', en: "I'm looking for a pharmacy" },
      { ja: '頭が痛いです', romaji: 'Atama ga itai desu', en: 'I have a headache' },
      { ja: 'お腹が痛いです', romaji: 'Onaka ga itai desu', en: 'I have a stomach ache' },
      { ja: '財布をなくしました', romaji: 'Saifu o nakushimashita', en: "I've lost my wallet" },
      { ja: 'タクシーを呼んでください', romaji: 'Takushī o yonde kudasai', en: 'Please call a taxi' },
      { ja: 'ここに行きたいです', romaji: 'Koko ni ikitai desu', en: 'I want to go here (while showing the address)' },
    ],
  },
]

export const PHRASE_COUNT = PHRASE_GROUPS.reduce((n, g) => n + g.items.length, 0)
