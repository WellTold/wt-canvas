// products.js
// Edit this file to add/remove products or update Faire links.
// 'folder' must exactly match the AWS S3 folder name (case-sensitive).
// 'faire_url' should be the full URL to the product listing on Faire.
// 'badge' is optional — set to "Bestseller", "New", etc. or leave out entirely.
// 'swatches' is optional — array of swatch objects shown on the card.
//   Color swatch (no variant): {color:'#hex', label:'Name'}
//   Color swatch (folder variant): {color:'#hex', label:'Name', folder:'S3-Folder-Name'}
//   Color swatch (hex variant):    {color:'#hex', label:'Name', color_hex:'#hex'}
//   Image swatch (folder variant): {image:'https://...', label:'Name', folder:'S3-Folder-Name'}
// When a swatch has 'folder' or 'color_hex', clicking it swaps the card image.
// The first swatch with variant data is shown by default on location load.

const PRODUCTS = [
  { id: "rocks",               name: "Home Town Map Rocks Glass",                    folder: "Rocks",                          faire_url: "https://www.faire.com/product/p_uhuhd5e4rq?fdb=welltold", badge: "Bestseller" },
  { id: "pint",                name: "Home Town Map Pint Glass",                     folder: "Pint",                           faire_url: "https://www.faire.com/product/p_94qnw2w5zk?fdb=welltold" },
  { id: "stemless-wine",       name: "Home Town Map Stemless Wine Glass",            folder: "Stemless-Wine",                  faire_url: "https://www.faire.com/product/p_z7pgnqp8r9?fdb=welltold" },
  { id: "stemmed-wine",        name: "Home Town Map Stemmed Wine Glass",             folder: "Stemmed-Wine",                   faire_url: "https://www.faire.com/product/p_9d8y2vgjbs?fdb=welltold" },
  { id: "can-glass",           name: "Home Town Map Can Glass",                      folder: "Can-Glass",                      faire_url: "https://www.faire.com/product/p_zzmrp7rfgp?fdb=welltold" },
  { id: "mason-jar",           name: "Home Town Map Mason Jar",                      folder: "Mason-Jar",                      faire_url: "https://www.faire.com/product/p_4ggyzqnptc?fdb=welltold" },
  { id: "coffee-mug",          name: "Home Town Map Glass Coffee Mug",               folder: "Coffee-Mug",                     faire_url: "https://www.faire.com/product/p_3epr6wr8ev?fdb=welltold" },
  {
    id: "ceramic-mug",
    name: "Home Town Map Ceramic Coffee Mug",
    folder: "Printed-Mug-15oz",
    color_hex: "#666666",
    faire_url: "https://www.faire.com/product/p_bsnbhbkr9q?fdb=welltold",
    swatches: [
      { color: '#666666', label: 'Gray',  color_hex: '#666666' },
      { color: '#0e494c', label: 'Teal',  color_hex: '#0e494c' },
      { color: '#1e2a58', label: 'Blue',  color_hex: '#1e2a58' },
      { color: '#3f1032', label: 'Plum',  color_hex: '#3f1032' },
    ]
  },
  {
    id: "white-tumbler-12oz",
    name: "Home Town Map Insulated Wine Tumbler 12oz",
    folder: "White-Tumbler-12oz",
    faire_url: "https://www.faire.com/product/p_qyxp6pkdbw?fdb=welltold",
    swatches: [
      { color: '#ffffff', label: 'White',         folder: 'White-Tumbler-12oz'         },
      { color: '#000000', label: 'Black',         folder: 'Black-Tumbler-12oz'         },
      { color: '#01205B', label: 'Midnight Blue', folder: 'Midnight-Blue-Tumbler-12oz' },
      { color: '#999999', label: 'Dockside Gray', folder: 'Dockside-Gray-Tumbler-12oz' },
      { color: '#FFFC06', label: 'Sunrise Yellow',folder: 'Sunrise-Yellow-Tumbler-12oz'},
      { color: '#47D698', label: 'Sunday Green',  folder: 'Sunday-Green-Tumbler-12oz'  },
      { color: '#CF578B', label: 'Sunset Pink',   folder: 'Sunset-Pink-Tumbler-12oz'   },
    ]
  },
  {
    id: "white-tumbler-16oz",
    name: "Home Town Map Insulated Coffee Tumbler 16oz",
    folder: "White-Coffee-Tumbler-16oz",
    faire_url: "https://www.faire.com/product/p_r9d2gfncz2?fdb=welltold",
    swatches: [
      { color: '#ffffff', label: 'White',         folder: 'White-Coffee-Tumbler-16oz'         },
      { color: '#47D698', label: 'Sunday Green',  folder: 'Sunday-Green-Coffee-Tumbler-16oz'  },
      { color: '#000000', label: 'Black',         folder: 'Black-Coffee-Tumbler-16oz'         },
      { color: '#999999', label: 'Dockside Gray', folder: 'Dockside-Gray-Coffee-Tumbler-16oz' },
    ]
  },
  {
    id: "white-tumbler-20oz",
    name: "Home Town Map Insulated Tumbler 20oz",
    folder: "White-Tumbler-20oz",
    faire_url: "https://www.faire.com/product/p_cxwurkrwam?fdb=welltold",
    swatches: [
      { color: '#ffffff', label: 'White',         folder: 'White-Tumbler-20oz'         },
      { color: '#01205B', label: 'Midnight Blue', folder: 'Midnight-Blue-Tumbler-20oz' },
      { color: '#000000', label: 'Black',         folder: 'Black-Tumbler-20oz'         },
      { color: '#999999', label: 'Dockside Gray', folder: 'Dockside-Gray-Tumbler-20oz' },
    ]
  },
  {
    id: "white-bottle-21oz",
    name: "Home Town Map Insulated Bottle 21oz",
    folder: "White-Bottle-21oz",
    faire_url: "https://www.faire.com/product/p_uhpanjvw2x?fdb=welltold",
    swatches: [
      { color: '#ffffff', label: 'White',         folder: 'White-Bottle-21oz'         },
      { color: '#000000', label: 'Black',         folder: 'Black-Bottle-21oz'         },
      { color: '#01205B', label: 'Midnight Blue', folder: 'Midnight-Blue-Bottle-21oz' },
      { color: '#999999', label: 'Dockside Gray', folder: 'Dockside-Gray-Bottle-21oz' },
      { color: '#47D698', label: 'Sunday Green',  folder: 'Sunday-Green-Bottle-21oz'  },
      { color: '#CF578B', label: 'Sunset Pink',   folder: 'Sunset-Pink-Bottle-21oz'   },
    ]
  },
  { id: "radius-board",        name: "Home Town Map Radius Board",                   folder: "Radius-Board",                   faire_url: "https://www.faire.com/product/p_6z7xxrr9w2?fdb=welltold" },
  { id: "essential-board",     name: "Home Town Map Essential Board",                folder: "Essential-Board",                faire_url: "https://www.faire.com/product/p_38r5yb5tv9?fdb=welltold" },
  { id: "modern-tray",         name: "Hometown Map Modern Tray",                     folder: "Tray-9x5-5",                     faire_url: "https://www.faire.com/product/p_93b5w6vvkk?fdb=welltold" },
  { id: "handle-board",        name: "Hometown Map Handle Board",                    folder: "Handle-Board",                   faire_url: "https://www.faire.com/product/p_tjvyzdk2mm?fdb=welltold" },
  { id: "host-server",         name: "Hometown Map Cherry Host Server",              folder: "Host-Server",                    faire_url: "https://www.faire.com/product/p_5re9bmh8qm?fdb=welltold" },
  { id: "coaster",             name: "Home Town Map Cork Coaster 4in",               folder: "Cork-Round-Coaster-4in",         faire_url: "https://www.faire.com/product/p_3cmnpvdqt8?fdb=welltold" },
  {
    id: "flask-black",
    name: "Home Town Map Pocket Flask",
    folder: "Matte-Black-Flask",
    faire_url: "https://www.faire.com/product/p_ykh56fgngp?fdb=welltold",
    swatches: [
      { color: '#ffffff', label: 'White', folder: 'Matte-White-Flask' },
      { color: '#1a1a1a', label: 'Black', folder: 'Matte-Black-Flask' },
    ]
  },
  {
    id: "ornament-black",
    name: "Home Town Map Ornament",
    folder: "Black-Silver-Ornament-3-75in",
    faire_url: "https://www.faire.com/product/p_88pxjtg7hk?bQ=ornament&refB=b_xcpbpqxrej",
    swatches: [
      { image: "https://welltolddesign.com/cdn/shop/t/87/assets/rustic-brown-gold_50x.png?v=8273587647294364701697636772", label: "Rustic Brown & Gold", folder: "Rustic-Brown-Gold-Ornament-3-75in" },
      { image: "https://welltolddesign.com/cdn/shop/t/87/assets/black-silver_50x.png?v=107865746675365322791697638012",   label: "Black & Silver",       folder: "Black-Silver-Ornament-3-75in"      },
      { image: "https://welltolddesign.com/cdn/shop/t/87/assets/brown-black_50x.png?v=150914186938840480871697638029",    label: "Brown & Black",        folder: "Brown-Black-Ornament-3-75in"       },
      { image: "https://welltolddesign.com/cdn/shop/t/87/assets/gray-black_50x.png?v=154765627514705511141697638039",     label: "Gray & Black",         folder: "Gray-Black-Ornament-3-75in"        },
    ]
  },
  {
    id: "candle-amber",
    name: "Home Town Map Candle 7.5oz",
    folder: "Amber-Black-Candle-2x7-7-5oz",
    faire_url: "https://www.faire.com/product/p_q4bsxvhkdc?fdb=welltold",
    swatches: [
      { color: '#FFFFFF', label: 'Clear Gold', folder: 'Clear-Gold-Candle-2x7-7-5oz' },
      { color: '#C87941', label: 'Amber',      folder: 'Amber-Black-Candle-2x7-7-5oz' },
    ]
  },
];

/*
{ id: "black-bottle-32",     name: "Hometown Map Black Bottle 32oz",              folder: "Black-Bottle-32oz",              faire_url: "FILL_IN" },
{ id: "white-bottle-32oz",   name: "Hometown Map White Bottle 32oz",              folder: "White-Bottle-32oz",              faire_url: "FILL_IN" },
*/
