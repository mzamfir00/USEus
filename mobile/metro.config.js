// The game engine (rules, scoring, briefings, geo maths, legal text) is shared with the web
// app and lives in ../src. Metro watches that folder so the native app imports the same code.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const shared = path.resolve(projectRoot, '../src');
const config = getDefaultConfig(projectRoot);

config.watchFolders = [shared];
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

module.exports = config;
