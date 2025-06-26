const withPlugins = require("next-compose-plugins");
const withImages = require("next-images");
/** @type {import("next").NextConfig} */
const nextConfig = {
  images: {
    domains: [process.env.NEXT_CDN_DOMAIN],
  },
};

module.exports = withPlugins([[withImages]], nextConfig);
