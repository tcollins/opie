#!/usr/bin/env node

'use strict';

var pkginfo = require('pkginfo')(module, 'version');
var program = require('commander');
var service = require('./lib/service');
var style = require('./lib/style');
var version = module.exports.version;

var cmdValue;
var cmdArgs;

program._name = 'opie';

var desc = [];
desc.push('Opie Commands:\n');
desc.push('\n');
desc.push('    start       :  start an instance                    : opie start <instance> [stack]\n');
desc.push('    stop        :  stop an instance                     : opie stop <instance> [stack]\n');
desc.push('    deploy      :  deploy an app to an instance         : opie deploy <app> <instance> [stack]\n');
desc.push('    list        :  list the configured stacks           : opie list\n');
desc.push('    add-stack   :  add a stack id to the configuration  : opie add-stack <stack id>\n');

program
  .version(version)
  .usage('<cmd> [args...]')
  .arguments('<cmd> [args...]')
  .description(desc.join(''))
  .option('-c, --comment <comment>', 'the comment to include for the deploy command')
  .action(function (cmd, args) {
     cmdValue = cmd;
     cmdArgs = args;
  });

program.parse(process.argv);


function catchAndLogError(promise){
  promise
  .catch(function(err){
    console.log(' ');
    console.log(style.errorLoud('** ERROR **'));
    console.log(style.error(err.message));
    console.log(' ');
    process.exit(1);
  });
}


if (typeof cmdValue === 'undefined') {
   console.log(' ');
   console.log(style.error('  You must provide a command!'));
   program.help();
   process.exit(1);
}


switch(cmdValue) {
    case 'add-stack':
        catchAndLogError(service.addStackId(cmdArgs[0]));
        break;
    case 'list':
        catchAndLogError(service.list());
        break;
    case 'start':
        catchAndLogError(service.start(cmdArgs));
        break;
    case 'stop':
        catchAndLogError(service.stop(cmdArgs));
        break;
    case 'deploy':
        catchAndLogError(service.deploy(cmdArgs, program.comment));
        break;
    default:
        console.log(' ');
        console.log(style.error('  Invalid command!    "' + cmdValue + '" is not a valid command'));
        console.log(' ');
        program.help();
        process.exit(1);
}
