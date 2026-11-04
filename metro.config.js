const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Caminhos absolutos do projeto para ignorar apenas as pastas locais
const projectExpoDir = path.resolve(__dirname, '.expo');
const projectDistDir = path.resolve(__dirname, 'dist');

const escapeRegExp = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Ignora estritamente as pastas locais do projeto para não conflitar com node_modules
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
    ? [config.resolver.blockList]
    : []),
  new RegExp(escapeRegExp(projectExpoDir)),
  new RegExp(escapeRegExp(projectDistDir)),
];

module.exports = config;
