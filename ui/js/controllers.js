'use strict';

app.controller('PageController', ['$scope', 'appconf', '$route', 'toaster', '$http', 'jwtHelper', 'menu', '$window', '$anchorScroll', '$routeParams',
function($scope, appconf, $route, toaster, $http, jwtHelper, menu, $window, $anchorScroll, $routeParams) {
    $scope.appconf = appconf;
    $scope.title = appconf.title;
    $scope.menu = menu;
    var jwt = localStorage.getItem($scope.appconf.jwt_id);
    if(jwt) { $scope.user = jwtHelper.decodeToken(jwt); }

    //this is a crap..
    $scope.reset_urls = function($routeParams) {
        appconf.breads.forEach(function(item) {
            if(!item.url) item.url = "#/"+item.id+"/"+$routeParams.instid;
        });
    }
}]);

app.controller('StartController', ['$scope', 'toaster', '$http', 'jwtHelper', 'scaMessage', 'instance', '$routeParams', '$location',
function($scope, toaster, $http, jwtHelper, scaMessage, instance, $routeParams, $location) {
    $location.path("/process/"+$routeParams.instid).replace();
}]);

app.controller('ImportController', ['$scope', 'toaster', '$http', 'jwtHelper', 'scaMessage', 'instance', '$routeParams', '$location', '$timeout', 'scaTask',
function($scope, toaster, $http, jwtHelper, scaMessage, instance, $routeParams, $location, $timeout, scaTask) {
    scaMessage.show(toaster);
    $scope.reset_urls($routeParams);

    instance.load($routeParams.instid).then(function(_instance) {
        $scope.instance = _instance;
    });

    $scope.taskid = $routeParams.taskid;

    $scope.task = scaTask.get($routeParams.taskid);

    $scope.$watchCollection('task', function(task) {
        if(task.status == "finished") $location.path("/process/"+$routeParams.instid);
    });

    $scope.back = function() {
        $location.path("/input/"+$routeParams.instid);
    }
}]);

app.controller('ProcessController', ['$scope', 'toaster', '$http', 'jwtHelper', 'scaMessage', 'instance', '$routeParams', '$location', '$interval',
function($scope, toaster, $http, jwtHelper, scaMessage, instance, $routeParams, $location, $interval) {
    scaMessage.show(toaster);
    $scope.reset_urls($routeParams);

    //make sure user has place to submit the main service (if not.. alert user!)
    $http.get($scope.appconf.sca_api+"/resource/best", {params: {
        service_id: "sca-service-qr",
    }}).then(function(res) {
        //console.log("best resource");
        //console.dir(res.data);
        $scope.best = res.data;
    }, function(res) {
        if(res.data && res.data.message) toaster.error(res.data.message);
        else toaster.error(res.statusText);
    });

    //load instance details
    instance.load($routeParams.instid).then(function(_instance) {
        $scope.instance = _instance;

        //set default parameters (TODO - not sure if this is the right place to do this)
        if(!$scope.instance.config) $scope.instance.config = {
            //process: "recon"
        }
    });

    $scope.submit = function() {
        //collect all image ids that we need
        var config = $scope.instance.config;
        var exps = {};
        if(config.dark) exps[config.dark._id] = config.dark.logical_id;
        if(config.flat) exps[config.flat._id] = config.flat.logical_id;
        if(config.bias) exps[config.bias._id] = config.bias.logical_id;
        if(config.raws) {
            for(var id in config.raws) {
                var raw = config.raws[id];
                exps[id] = raw.logical_id;
            }
        }
        
        //submit sca-service-odi to stage the data
        $http.post($scope.appconf.sca_api+"/task", {
            instance_id: $scope.instance._id,
            service_id: "sca-product-odi",
            config: {
                exposures: exps,
                /*
                odi_api: {
                    url: 'https://soichi7.ppa.iu.edu/api/odi',
                    //I should contact auth service to give me a temporarly (short)
                    //token with smaller set of access
                    jwt: localStorage.getItem($scope.appconf.jwt_id)
                }
                */
            },
        })
        .then(function(res) {
            var odi_task = res.data.task;
        
            //then submit qr service
            //get rid of unnecessary stuff
            var qr_config = angular.copy($scope.instance.config);
            qr_config.dark = null;
            if($scope.instance.config.dark) qr_config.dark = $scope.instance.config.dark._id;
            qr_config.flat = null;
            if($scope.instance.config.flat) qr_config.flat = $scope.instance.config.flat._id;
            qr_config.bias= null;
            if($scope.instance.config.bias) qr_config.bias = $scope.instance.config.bias._id;
            qr_config.raws = [];
            for(var id in $scope.instance.config.raws) qr_config.raws.push(id);
     
            //finally submit!
            $http.post($scope.appconf.sca_api+"/task", {
                instance_id: $scope.instance._id,
                service_id: "sca-service-qr",
                config: qr_config,
                deps: [odi_task._id],
            })
            .then(function(res) {
                $location.path("/task/"+$routeParams.instid+"/"+res.data.task._id);
            }, function(res) {
                if(res.data && res.data.message) toaster.error(res.data.message);
                else toaster.error(res.statusText);
            });
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
        
    }

    $scope.addinput = function() {
        $location.path("/input/"+$routeParams.instid);
    }
    $scope.addcalib = function(type) {
        $location.path("/calib/"+$routeParams.instid+"/"+type);
    }

    //$scope.editingheader = false;
    $scope.editheader = function() {
        $scope.editingheader = true;
    }
    $scope.updateheader = function() {
        instance.save($scope.instance).then(function(_instance) {
            $scope.editingheader = false;
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    }

}]);

app.controller('InputController', ['$scope', 'toaster', '$http', 'jwtHelper', 'scaMessage', 'instance', '$routeParams', '$location',
function($scope, toaster, $http, jwtHelper, scaMessage, instance, $routeParams, $location) {
    scaMessage.show(toaster);
    $scope.reset_urls($routeParams);
    instance.load($routeParams.instid).then(function(_instance) {
        $scope.instance = _instance;
        if(!$scope.instance.config) $scope.instance.config = {};
        if(!$scope.instance.config.raws) $scope.instance.config.raws = {};
    });

    $scope.curpage = 0;
    $scope.limit = 40;
    $scope.query = "FILTER:odi_r";

    $scope.apply_query = function() {
        $scope.find = {"type": "object"}; 

        var queries = $scope.query.split(" ");
        queries.forEach(function(query) {
            var tokens = query.split(":");
            var key = "headers."+tokens[0];
            if(tokens.length == 2) $scope.find[key] = tokens[1]; 
        });
        $scope.curpage = 0;
        search();
    }
    $scope.apply_query();
    
    function search() {
        //console.dir($scope.find);
        $http.get($scope.appconf.odi_api+"/exposures", {params: {
            find: $scope.find,
            skip: $scope.curpage*$scope.limit,
            limit: $scope.limit,
            select: 'logical_id headers.OBSLOGIN headers.FILTER headers.PROGID headers.PROPID headers.TELFOCUS headers.NEXTEND headers.AIRMASS headers.ZD headers.DEC headers.RA', //TODO
        }})
        .then(function(res) {
            //create a list of all headers 
            $scope.headers = [];
            res.data.exposures.forEach(function(exposure) {
                for(var k in exposure.headers) {
                    if(!~$scope.headers.indexOf(k)) $scope.headers.push(k);
                } 
            });
            $scope.exps = res.data.exposures;
            $scope.count = res.data.count;
            $scope.pages = Math.ceil(res.data.count/40);
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    }
    $scope.check = function(exp) {
        if($scope.instance.config.raws[exp._id]) {
            delete $scope.instance.config.raws[exp._id];
        } else {
            $scope.instance.config.raws[exp._id] = exp;
        }
    }

    $scope.topage = function(page) {
        if(page < 0) return 1;
        if(page > $scope.count / $scope.limit) return 1;
        $scope.curpage = page;
        search();
    }

    $scope.back = function() {
        $location.path("/process/"+$routeParams.instid);
    }
    $scope.done = function() {
        instance.save($scope.instance).then(function(_instance) {
            $location.path("/process/"+$routeParams.instid);
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    }
}]);

app.controller('CalibController', ['$scope', 'toaster', '$http', 'jwtHelper', 'scaMessage', 'instance', '$routeParams', '$location',
function($scope, toaster, $http, jwtHelper, scaMessage, instance, $routeParams, $location) {
    scaMessage.show(toaster);
    $scope.reset_urls($routeParams);
    instance.load($routeParams.instid).then(function(_instance) {
        $scope.instance = _instance;
        if(!$scope.instance.config) $scope.instance.config = {};
        if(!$scope.instance.config.raws) $scope.instance.config.raws = {};
    });

    $scope.type = $routeParams.type;//bias, dark or flat
    $scope.curpage = 0;
    $scope.limit = 40;
    $scope.query = "FILTER:odi_r";

    $scope.apply_query = function() {
        switch($scope.type) {
        case "flat":
            $scope.find = {"type": {$in: ["tflat", "dflat"]}}; 
            break;
        default:
            $scope.find = {"type": $scope.type}; 
        }

        var queries = $scope.query.split(" ");
        queries.forEach(function(query) {
            var tokens = query.split(":");
            var key = "headers."+tokens[0];
            if(tokens.length == 2) $scope.find[key] = tokens[1]; 
        });
        $scope.curpage = 0;
        search();
    }
    $scope.apply_query();
    
    function search() {
        $http.get($scope.appconf.odi_api+"/exposures", {params: {
            find: $scope.find,
            skip: $scope.curpage*$scope.limit,
            limit: $scope.limit,
            select: 'logical_id headers.OBJECT headers.OBSLOGIN headers.FILTER headers.PROPID headers.PROGID headers.OBSTYPE headers.NEXTEND headers.EXPTIME headers.CAL-OBS', //TODO
        }})
        .then(function(res) {
            //create a list of all headers 
            $scope.headers = [];
            res.data.exposures.forEach(function(exposure) {
                for(var k in exposure.headers) {
                    if(!~$scope.headers.indexOf(k)) $scope.headers.push(k);
                } 
            });
            $scope.exps = res.data.exposures;
            $scope.count = res.data.count;
            $scope.pages = Math.ceil(res.data.count/40);
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    }
    $scope.select = function(exp) {
        $scope.instance.config[$scope.type] = exp;

        instance.save($scope.instance).then(function(_instance) {
            $location.path("/process/"+$routeParams.instid);
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    }
    $scope.topage = function(page) {
        if(page < 0) return 1;
        if(page > $scope.count / $scope.limit) return 1;
        $scope.curpage = page;
        search();
    }
    $scope.back = function() {
        $location.path("/process/"+$routeParams.instid);
    }
}]);

app.controller('TaskController', ['$scope', 'toaster', '$http', 'jwtHelper', 'scaMessage', 'instance', '$routeParams', '$location', 'scaTask',
function($scope, toaster, $http, jwtHelper, scaMessage, instance, $routeParams, $location, scaTask) {
    scaMessage.show(toaster);
    $scope.reset_urls($routeParams);

    $scope.taskid = $routeParams.taskid;
    $scope.jwt = localStorage.getItem($scope.appconf.jwt_id);

    $scope.task = scaTask.get($routeParams.taskid);

    $scope.resource = null; //resource where this task is running/ran

    //need to keep watching until resource_id gets set
    $scope.$watchCollection('task', function(task) {
       //also load resource info
        if(task.resource_id && !$scope.resource) {
            $scope.resource = {}; //prevent double loading while I wait response from /resource
            $http.get($scope.appconf.sca_api+"/resource", {params: {
                where: {_id: task.resource_id}
            }})
            .then(function(res) {
                $scope.resource = res.data[0];
                //console.dir($scope.resource);
            }, function(res) {
                if(res.data && res.data.message) toaster.error(res.data.message);
                else toaster.error(res.statusText);
            });
        }
    });

    $scope.back = function() {
        $location.path("/process/"+$routeParams.instid);
    }
}]);

//just a list of previously submitted tasks
app.controller('TasksController', ['$scope', 'menu', 'scaMessage', 'toaster', 'jwtHelper', '$http', '$location', '$routeParams', 'instance',
function($scope, menu,  scaMessage, toaster, jwtHelper, $http, $location, $routeParams, instance) {
    scaMessage.show(toaster);
    $scope.reset_urls($routeParams);

    instance.load($routeParams.instid).then(function(_instance) { $scope.instance = _instance; });

    //load previously submitted tasks
    $http.get($scope.appconf.sca_api+"/task", {params: {
        where: {
            instance_id: $routeParams.instid,
            service_id: "sca-service-qr",
        }
    }})
    .then(function(res) {
        $scope.tasks = res.data;
    }, function(res) {
        if(res.data && res.data.message) toaster.error(res.data.message);
        else toaster.error(res.statusText);
    });

    $scope.open = function(task) {
        $location.path("/task/"+$routeParams.instid+"/"+task._id);
    }
    $scope.back = function() {
        $location.path("/process/"+$routeParams.instid);
    }
}]);

