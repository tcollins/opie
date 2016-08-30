#!/usr/bin/env node

'use strict';

var fs = require('fs');
var jsonfile = require('jsonfile');
jsonfile.spaces = 4;


var defaultConfig = {
  awsRegion: 'us-east-1',
  stackIds: []
};

// read the config from the user dir, it doesn't exist create it form the defaultConfig
var homeDir = (process.platform == 'win32'? process.env.USERPROFILE: process.env.HOME);
var userConfigFile = homeDir + '/.opie.json';

var userConfig = defaultConfig;
try{
  userConfig = jsonfile.readFileSync(userConfigFile);
}catch(err){
  jsonfile.writeFileSync(userConfigFile, defaultConfig);
}

var config = {
  data: userConfig,
  save: function(){
    jsonfile.writeFileSync(userConfigFile, this.data);
  }
};

module.exports = config;
