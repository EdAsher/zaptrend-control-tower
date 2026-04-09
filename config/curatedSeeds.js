"use strict";

const CURATED_SEEDS = {
  TH: {
    beauty_skincare: [
      {
        source_id: "th_beauty_curated_pimtha_ig",
        display_name: "Pimtha",
        handle: "@pimtha",
        platform: "instagram",
        url: "https://www.instagram.com/pimtha/"
      },
      {
        source_id: "th_beauty_curated_mintchyy_ig",
        display_name: "Mintchyy",
        handle: "@mintchyy",
        platform: "instagram",
        url: "https://www.instagram.com/mintchyy/"
      },
      {
        source_id: "th_beauty_curated_mintchyy_yt",
        display_name: "Mintchyy",
        handle: "@mintchyy",
        platform: "youtube",
        url: "https://www.youtube.com/@mintchyy"
      }
    ]
  },

  JP: {
    souvenirs_local_finds: [
      {
        source_id: "jp_souvenir_curated_ryuspenna_yt",
        display_name: "RYUSPENNA",
        handle: "@RYUSPENNA",
        platform: "youtube",
        url: "https://www.youtube.com/@RYUSPENNA"
      },
      {
        source_id: "jp_souvenir_curated_rikarussell_yt",
        display_name: "Rika Russell",
        handle: "@rikarussell",
        platform: "youtube",
        url: "https://www.youtube.com/@rikarussell"
      },
      {
        source_id: "jp_souvenir_curated_meimeeiiiiiiii_yt",
        display_name: "meimeeiiiiiiii",
        handle: "@meimeeiiiiiiii",
        platform: "youtube",
        url: "https://www.youtube.com/@meimeeiiiiiiii/videos"
      },
      {
        source_id: "jp_souvenir_curated_hellosophiemos_yt",
        display_name: "Hello Sophie",
        handle: "@hellosophiemos",
        platform: "youtube",
        url: "https://www.youtube.com/@hellosophiemos"
      },
      {
        source_id: "jp_souvenir_curated_jeffandtimmy_yt",
        display_name: "Jeff and Timmy",
        handle: "@JeffandTimmy",
        platform: "youtube",
        url: "https://www.youtube.com/@JeffandTimmy/videos"
      }
    ]
  }
};

function getCuratedSeeds(country, category) {
  const c = String(country || "").toUpperCase();
  const k = String(category || "").toLowerCase();
  return CURATED_SEEDS[c]?.[k] || [];
}

module.exports = {
  CURATED_SEEDS,
  getCuratedSeeds
};