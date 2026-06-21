// tv/regions.js — region/prefecture vocabulary for channel search.
// Stations only carry their broad region (group). This maps each group to the
// place names a viewer might search — region label (EN + JA) and every
// prefecture in it (romaji + kanji) — so "okinawa" / "大阪" / "関東" surface the
// right stations even when the channel name doesn't contain the term.
// Distinct from region.js (window.Region = viewer-country geolocation).
(function () {
  "use strict";

  // group -> { en, ja, extra?, prefectures: [[romaji, kanji], ...] }
  const REGIONS = {
    "National":        { en: "National", ja: "全国", extra: ["nationwide", "zenkoku"], prefectures: [] },
    "BS / Satellite":  { en: "BS / Satellite", ja: "BS 衛星", extra: ["bs", "satellite"], prefectures: [] },
    "Hokkaido":        { en: "Hokkaido", ja: "北海道", extra: ["sapporo", "札幌"],
      prefectures: [["hokkaido", "北海道"]] },
    "Tohoku":          { en: "Tohoku", ja: "東北", extra: ["sendai", "仙台"],
      prefectures: [["aomori", "青森"], ["iwate", "岩手"], ["miyagi", "宮城"], ["akita", "秋田"], ["yamagata", "山形"], ["fukushima", "福島"]] },
    "Kanto":           { en: "Kanto", ja: "関東", extra: ["yokohama", "横浜"],
      prefectures: [["tokyo", "東京"], ["kanagawa", "神奈川"], ["saitama", "埼玉"], ["chiba", "千葉"], ["ibaraki", "茨城"], ["tochigi", "栃木"], ["gunma", "群馬"]] },
    "Chubu":           { en: "Chubu", ja: "中部", extra: ["nagoya", "名古屋", "tokai", "東海"],
      prefectures: [["aichi", "愛知"], ["shizuoka", "静岡"], ["gifu", "岐阜"], ["nagano", "長野"], ["niigata", "新潟"], ["toyama", "富山"], ["ishikawa", "石川"], ["fukui", "福井"], ["yamanashi", "山梨"]] },
    "Kansai":          { en: "Kansai", ja: "関西", extra: ["kinki", "近畿", "kobe", "神戸"],
      prefectures: [["osaka", "大阪"], ["kyoto", "京都"], ["hyogo", "兵庫"], ["nara", "奈良"], ["wakayama", "和歌山"], ["shiga", "滋賀"], ["mie", "三重"]] },
    "Chugoku":         { en: "Chugoku", ja: "中国",
      prefectures: [["hiroshima", "広島"], ["okayama", "岡山"], ["yamaguchi", "山口"], ["shimane", "島根"], ["tottori", "鳥取"]] },
    "Shikoku":         { en: "Shikoku", ja: "四国",
      prefectures: [["kagawa", "香川"], ["ehime", "愛媛"], ["tokushima", "徳島"], ["kochi", "高知"]] },
    "Kyushu-Okinawa":  { en: "Kyushu-Okinawa", ja: "九州 沖縄",
      prefectures: [["fukuoka", "福岡"], ["kumamoto", "熊本"], ["nagasaki", "長崎"], ["oita", "大分"], ["saga", "佐賀"], ["miyazaki", "宮崎"], ["kagoshima", "鹿児島"], ["okinawa", "沖縄"]] },
    "Other":           { en: "Other", ja: "その他", prefectures: [] },
  };

  // One lowercased, space-joined bag of place terms for a group — the searchable
  // "haystack" for every station in that region. Unknown group -> Other.
  function haystack(group) {
    const r = REGIONS[group] || REGIONS["Other"];
    const parts = [r.en, r.ja, ...(r.extra || [])];
    for (const [romaji, kanji] of r.prefectures) parts.push(romaji, kanji);
    return parts.join(" ").toLowerCase();
  }

  const api = { REGIONS, haystack };
  if (typeof globalThis !== "undefined") globalThis.RegionSearch = api;
})();
