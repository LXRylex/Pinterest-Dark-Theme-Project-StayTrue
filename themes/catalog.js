(function () {
  const legacyThemes = [
    {
      id: "classic-black",
      name: "Original AMOLED Theme",
      description: "Default AMOLED Theme based on first developer version that was not published",
      vars: {
        d1: "black",
        d2: "rgb(20, 20, 20)",
        d3: "rgb(30, 30, 30)",
        d4: "rgb(50, 50, 50)",
        l1: "#ffffff",
        l2: "rgb(160, 160, 160)",
        l3: "rgb(120, 120, 120)",
      },
    },
    {
      id: "classic-dark-purple",
      name: "Dark Purple",
      description: "Dark Purple Theme, a copy of Original AMOLED Theme same as others but re-colored",
      vars: {
        d1: "#1a1325",
        d2: "#302c36",
        d3: "#46434c",
        d4: "#5e5b63",
        l1: "#ffffff",
        l2: "#908e94",
        l3: "#77747b",
      },
    },
    {
      id: "classic-dark-gray",
      name: "Gray Theme v1.5",
      vars: {
        d1: "#181818",
        d2: "#2d2d2d",
        d3: "#444444",
        d4: "#5b5b5b",
        l1: "#ffffff",
        l2: "#8f8f8f",
        l3: "#747474",
      },
    },
    {
      id: "classic-dark-blue",
      name: "Dark Blue",
      vars: {
        d1: "#0d0d20",
        d2: "#2e2e3a",
        d3: "#454450",
        d4: "#5d5c67",
        l1: "#ffffff",
        l2: "#908f97",
        l3: "#76757e",
      },
    },
    {
      id: "classic-dark-pink",
      name: "Dark Pink",
      vars: {
        d1: "#22080f",
        d2: "#440719",
        d3: "#5c162a",
        d4: "#A4133C",
        l1: "#FFF0F3",
        l2: "#FFB3C1",
        l3: "#FF8FA3",
      },
    },
    {
      id: "classic-dark-laven",
      name: "Dark Laven",
      vars: {
        d1: "#2c2135",
        d2: "#352d3f",
        d3: "#352c47",
        d4: "#573d7f",
        l1: "#dbcef1",
        l2: "#cfbbf8",
        l3: "#c2a6ff",
      },
    },
    {
      id: "classic-light-pink",
      name: "Light Pink",
      vars: {
        d1: "#FFF0F3",
        d2: "#FFCCD5",
        d3: "#FFB3C1",
        d4: "#FF8FA3",
        l1: "#590D22",
        l2: "#800F2F",
        l3: "#A4133C",
      },
    },
  ];

  window.XZEN_THEME_CATALOG = [
    {
      id: "amoled",
      name: "AMOLED Theme v1.5",
      description: "Original v1.5 Version with Purple Accent",
      cssFile: "amoled.css",
      customizableAccent: true,
      defaultAccent: "#B38AFF",
    },
    {
      id: "amoled-v2",
      name: "AMOLED V2 Theme",
      description:
        "New experimental AMOLED Project that uses new algorithm. It is not fully out yet. But planned to support every pinterest UI / Element",
      cssFile: "amoled-v2.css",
      customizableAccent: true,
      defaultAccent: "#8E6BFF",
      badge: "NEW",
      highlight: true,
    },
    {
      id: "gray",
      name: "Gray Theme v1.0",
      description: "Original Gray Theme, based on AMOLED v1.5",
      cssFile: "gray.css",
    },
    ...legacyThemes.map((theme) => ({
      ...theme,
      cssFile: "themes/main.css",
      badge: "OLD",
      legacy: true,
    })),
  ];
})();
