#!/usr/bin/env node

'use strict';

var config = require('../lib/config');
var style = require('../lib/style');
var BBPromise = require('bluebird');
var tab = require('table-master');

tab.setDefaults({
   indent  : 1, // indentation at the begin of each line
   rowSpace: 2  // spacing between the columns
});

var AWS = require('aws-sdk');
AWS.config.region = config.data.awsRegion;

// the s3 client with promise support
var opsWorks = new BBPromise.promisifyAll(new AWS.OpsWorks(), {suffix: 'UsingPromise'});


function start(args){

  return describeStacks()
  .then(function(data){
    var instance = findInstance(args,data);
    if(instance){
      console.log(style.info('Starting "' + instance.name + '" on stack "'+instance.stackName+'"'));
      return opsWorks.startInstanceUsingPromise({InstanceId: instance.id})
      .then(function(data){
        return data;
      });

    }
  });

}

function stop(args){

  return describeStacks()
  .then(function(data){
    var instance = findInstance(args,data);
    if(instance){
      console.log(style.info('Stopping "' + instance.name + '" on stack "'+instance.stackName+'"'));
      return opsWorks.stopInstanceUsingPromise({InstanceId: instance.id})
      .then(function(data){
        return data;
      });

    }
  });

}


function deploy(args, comment){

  return describeStacks()
  .then(function(data){
    var instance = findInstance(args,data);
    if(instance){
      var apps = findObjectsByTypeAndName(args, 'app', data);
      if(apps && apps.length > 0){
        var app = apps[0];
        if(app.stackId === instance.stackId){

          console.log(style.info('Deploying "' + app.name + '" to "' + instance.name + '" on stack "'+instance.stackName+'"'));

          var params = {
            Command: {
              Name: 'deploy'
            },
            StackId: app.stackId,
            AppId: app.id,
            Comment: comment || '',
            InstanceIds: [instance.id]
          };

          return opsWorks.createDeploymentUsingPromise(params)
          .then(function(data){
            return data;
          });

        }else{
          console.log(style.error('App and instance must belong to the same stack.'));
        }
      }else{
        console.log(style.error('Could not find an app with the supplied arguments: ' + args));
      }
    }

  });

}

function addStackId(stackId){
  return new BBPromise(function(resolve, reject) {
    try{
      if(stackId){
        config.data.stackIds.push(stackId);
        config.save();
        console.log(style.info('Stack Id added.  Run "opie list" to see your stack.'));
        resolve();
      }else{
        reject(new Error('Invalid stack id'));
      }
    }catch(err){
      reject(err);
    }
  });
}


function list(){

  return describeStacks()
  .then(function(data){
    console.log(' ');
    for(var i=0; i<data.length; i++){
      consoleStack(data[i]);
      console.log(' ');
    }
  });

}

////**********************
////** HELPERS
////**********************

function consoleStack(data){
  var stack = data.stack;
  var apps = data.apps;
  var instances = data.instances;
  var table = [];
  var cmd;

  var row = function(styleFn, type, name, status, ip, completed, cmd){

    var statusFn = style.statusNeutral;
    if(status === 'online' || status === 'successful'){
      statusFn = style.statusPositive;
    }else if(status === 'stopped' || status === 'failed'){
      statusFn = style.statusNegative;
    }else if(status === '---'){
      statusFn = style.cell;
    }

    var obj = {};
    obj[style.header('Type')] = styleFn(type);
    obj[style.header('Name')] = style.header(name);
    obj[style.header('Status')] = statusFn(status);
    obj[style.header('Public / Private IP')] = style.cell(ip);
    obj[style.header('Completed')] = style.cell(completed);
    obj[style.header('Command')] = style.muted(cmd);
    return obj;
  };


  table.push(row(style.stack,'STACK',stack.Name,'---','---','---','---'));

  if(instances){
    for(var j=0; j<instances.length; j++){
      var startStop = 'stop';
      if(instances[j].Status === 'stopped'){
        startStop = 'start';
      }

      var pubPrvIp = '---';
      if(instances[j].PublicIp && instances[j].PrivateIp){
        pubPrvIp = instances[j].PublicIp + ' / ' + instances[j].PrivateIp;
      }else if(instances[j].PrivateIp){
        pubPrvIp = '--- / ' + instances[j].PrivateIp;
      }
      else if(instances[j].PrivateIp){
        pubPrvIp = instances[j].PublicIp + ' / ---';
      }

      cmd = 'opie ' + startStop + ' ' + instances[j].Hostname;
      table.push(row(style.instance,'INSTANCE',instances[j].Hostname,instances[j].Status,pubPrvIp,'---',cmd));

    }
  }

  if(apps){
    for(var i=0; i<apps.length; i++){
      var inst = '{instance}';
      if(instances && instances.length > 0){
        inst = instances[0].Hostname;
      }
      cmd = 'opie deploy ' + apps[i].Shortname + ' ' + inst;

      var status = '---';
      var completed = '---';
      if(apps[i].LatestDeployment){
        status = apps[i].LatestDeployment.Status;
        if(apps[i].LatestDeployment.CompletedAt && apps[i].LatestDeployment.Duration){
          completed = apps[i].LatestDeployment.CompletedAt + ' ('+apps[i].LatestDeployment.Duration+' secs)';
        }
      }

      table.push(row(style.app,'APP',apps[i].Shortname,status,'---',completed,cmd));

    }
  }


  console.table(table);

}





function findInstance(args, data){
  var i;
  var instance = false;
  var instances = findObjectsByTypeAndName(args, 'instance', data);

  if(instances && instances.length > 0){

    if(instances.length === 1){
      instance = instances[0];
    }else{
      var stacks = findObjectsByTypeAndName(args, 'stack', data);
      if(stacks && stacks.length>0){
        var stack = stacks[0];
        for(i=0; i<instances.length; i++){
          if(instances[i].stackId === stack.stackId){
            instance = instances[i];
          }
        }
      }else{
        console.log(style.error('Found more than one instance with the supplied arguments: ' + args));
        for(i=0; i<instances.length; i++){
          console.log(style.error('    ' + instances[i].name + ' : ' + instances[i].stackName));
        }
        console.log(style.error('Include the stack name to clarify.'));
      }
    }
  }

  if(instance){
    return instance;
  }else{
    console.log(style.error('Could not find an instance with the supplied arguments: ' + args));
  }

}

function findObjectsByTypeAndName(args, type, data){

  var i,j;
  var matches = [];

  if(args && args.length){

    for(i=0; i<args.length; i++){
      var objs = findObjectsByName(args[i], data);
      if(objs && objs.length > 0){
        for(j=0; j<objs.length; j++){
          if(objs[j].type === type){
            matches.push(objs[j]);
          }
        }
      }
    }

  }

  return matches;
}

function findObjectsByName(name, data){
  var objs = [];
  if(data){
    for(var i=0; i<data.length; i++){
      var stack = data[i].stack;
      var apps = data[i].apps;
      var instances = data[i].instances;
      var j;

      if(stack.Name === name){
        objs.push({id:stack.StackId, name: stack.Name, stackName: stack.Name, stackId:stack.StackId, type:'stack'});
      }

      if(apps && apps.length){
        for(j=0; j<apps.length; j++){
          if(apps[j].Shortname === name){
            objs.push({id:apps[j].AppId, name: apps[j].Shortname, stackName: stack.Name, stackId:stack.StackId, type:'app'});
          }
        }
      }

      if(instances && instances.length){
        for(j=0; j<instances.length; j++){
          if(instances[j].Hostname === name){
            objs.push({id:instances[j].InstanceId, name: instances[j].Hostname, stackName: stack.Name, stackId:stack.StackId, type:'instance'});
          }
        }
      }

    }
  }
  return objs;
}



function describeStacks(){

  return new BBPromise(function(resolve, reject) {
    try{
      if(config.data.stackIds && config.data.stackIds.length > 0){
        var ids = config.data.stackIds;
        var requests = [];

        for(var i=0; i<ids.length; i++){
          requests.push(describeStack(ids[i]));
        }

        BBPromise.all(requests)
        .then(function(data){
          resolve(data);
        });

      }else{
        reject(new Error('No configured stacks, use add-stack to configure a stack id.'));
      }
    }catch(err){
      reject(err);
    }
  });

}

function describeStack(stackId){

  var fStacks = opsWorks.describeStacksUsingPromise({StackIds: [stackId]});
  var fApps = opsWorks.describeAppsUsingPromise({StackId: stackId});
  var fInstances = opsWorks.describeInstancesUsingPromise({StackId: stackId});

  return BBPromise.join(fStacks, fApps, fInstances, function(stacks,apps,instances){
    var obj = {stack:stacks.Stacks[0], apps:apps.Apps, instances:instances.Instances};
    return obj;
  })
  .then(function(data){

    if(data.apps && data.apps.length>0){
      var requests = [];
      var i,j;
      for(i=0; i< data.apps.length; i++){
        requests.push(opsWorks.describeDeploymentsUsingPromise({AppId: data.apps[i].AppId}));
      }

      return BBPromise.all(requests)
      .then(function(deploymentData){

        var latestDeployments = [];
        for (i = 0; i < deploymentData.length; i++) {
          latestDeployments.push(deploymentData[i].Deployments[0]);
        }

        for(i=0; i< data.apps.length; i++){
          for(j=0; j< latestDeployments.length; j++){
            if(data.apps[i].AppId === latestDeployments[j].AppId){
              data.apps[i].LatestDeployment = latestDeployments[j];
            }
          }
        }

        return data;
      });

    }

    return data;
  });


}




module.exports = {
  start: start,
  stop: stop,
  deploy: deploy,
  addStackId: addStackId,
  list: list,
};
