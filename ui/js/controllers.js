'use strict';

app.controller('PageController', function($scope, appconf, $route, toaster, $http, jwtHelper, menu, $window, $anchorScroll, $routeParams, instance) {
    $scope.appconf = appconf;
    $scope.title = appconf.title;
    $scope.menu = menu;
    var jwt = localStorage.getItem($scope.appconf.jwt_id);
    if(jwt) { $scope.user = jwtHelper.decodeToken(jwt); }

    //this is a crap..
    $scope.reset_urls = function($routeParams) {
        appconf.breads.forEach(function(item) {
            if(!item.url) item.url = "#/"+item.id;
        });
    }

    instance.then(function(_instance) {
        $scope.instance = _instance;
    });
    $scope.save_instance = function(cb) {
        console.log("saving instance");
        $http.put($scope.appconf.wf_api+'/instance/'+$scope.instance._id, $scope.instance).then(function(res) {
            if(cb) cb();
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    }

    $scope.remove_raw = function(id) {
        delete $scope.instance.config.raws[id];
        $scope.save_instance();
    } 
});

app.controller('StartController', ['$scope', 'toaster', '$http', 'jwtHelper', 'scaMessage', 'instance', '$routeParams', '$location',
function($scope, toaster, $http, jwtHelper, scaMessage, instance, $routeParams, $location) {
    $location.path("/process").replace();
}]);

app.controller('ImportController', ['$scope', 'toaster', '$http', 'jwtHelper', 'scaMessage', 'instance', '$routeParams', '$location', '$timeout', 'scaTask',
function($scope, toaster, $http, jwtHelper, scaMessage, instance, $routeParams, $location, $timeout, scaTask) {
    scaMessage.show(toaster);
    $scope.reset_urls($routeParams);

    /*
    instance.then(function(_instance) {
        $scope.instance = _instance;
    });
    */

    $scope.taskid = $routeParams.taskid;

    $scope.task = scaTask.get($routeParams.taskid);

    $scope.$watchCollection('task', function(task) {
        if(task.status == "finished") $location.path("/process");
    });

    $scope.back = function() {
        $location.path("/input");
    }
}]);

app.controller('ProcessController', ['$scope', 'toaster', '$http', 'jwtHelper', 'scaMessage', 'instance', '$routeParams', '$location', '$interval',
function($scope, toaster, $http, jwtHelper, scaMessage, instance, $routeParams, $location, $interval) {
    scaMessage.show(toaster);
    $scope.reset_urls($routeParams);

    //make sure user has place to submit the main service (if not.. alert user!)
    $http.get($scope.appconf.sca_api+"/resource/best", {params: {
        service: "soichih/sca-service-qr",
    }}).then(function(res) {
        //console.log("best resource");
        //console.dir(res.data);
        $scope.best = res.data;
    }, function(res) {
        if(res.data && res.data.message) toaster.error(res.data.message);
        else toaster.error(res.statusText);
    });

    //load instance details
    instance.then(function(_instance) {
        //$scope.instance = _instance;

        console.log("got from service");
        console.dir(_instance);
        //
        //set default parameters (TODO - not sure if this is the right place to do this)
        if(!$scope.instance.config) $scope.instance.config = {
            params: {
                wcs: true,
            },
        }
    });

    $scope.submit = function() {
        //collect all image ids that we need
        var config = $scope.instance.config;
        var exps = [];
        if(config.raws) {
            for(var id in config.raws) {
                var raw = config.raws[id];
                //exps[id] = raw.logical_id;
                exps.push(id);
            }
        }

        function submit_stage() {
            return $http.post($scope.appconf.wf_api+"/task", {
                instance_id: $scope.instance._id,
                service: "soichih/sca-product-odi",
                config: {
                    exps: exps,
                    dark: config.dark._id,
                    flat: config.flat._id,
                    bias: config.bias._id,
                },
            })
        }

        function submit_qr(res) {
            var odi_task = res.data.task;
            return $http.post($scope.appconf.wf_api+"/task", {
                instance_id: $scope.instance._id,
                service: "soichih/sca-service-qr",
                config: {
                    input_task_id: odi_task._id, //where we have our input data stored
                    params: config.params,
                },
                deps: [odi_task._id],
            })
        }

        function submit_png(res) {
            var qr_task = res.data.task;
            return $http.post($scope.appconf.wf_api+"/task", {
                instance_id: $scope.instance._id,
                service: "soichih/sca-service-fits2png",
                config: {
                    input_task_id: qr_task._id, //where we have our input data stored
                },
                deps: [qr_task._id],
            })
        }

        submit_stage().then(submit_qr).then(submit_png)
        .then(function(res) {
            var last_task = res.data.task;
            $location.path("/task/"+last_task._id);
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
    }

    $scope.addinput = function() {
        $location.path("/input");
    }
    $scope.addcalib = function(type) {
        $location.path("/calib/"+type);
    }


    //$scope.editingheader = false;
    $scope.editheader = function() {
        $scope.editingheader = true;
    }
    $scope.updateheader = function() {
        /*
        instance.save($scope.instance).then(function(_instance) {
            $scope.editingheader = false;
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
        */
        /*
        $http.put($scope.appconf.wf_api+'/instance/'+$scope.instance._id, $scope.instance).then(function(res) {
            $scope.editingheader = false;
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
        */
        $scope.save_instance(function() {
            $scope.editingheader = false;
        });
    }

}]);

app.controller('InputController', ['$scope', 'toaster', '$http', 'jwtHelper', 'scaMessage', 'instance', '$routeParams', '$location',
function($scope, toaster, $http, jwtHelper, scaMessage, instance, $routeParams, $location) {
    scaMessage.show(toaster);
    $scope.reset_urls($routeParams);
    instance.then(function(_instance) {
        //$scope.instance = _instance;
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
            if(tokens.length == 2) $scope.find[key] = {$regex: tokens[1], $options: 'ix'}; 
        });
        $scope.curpage = 0;
        search();
    }
    $scope.apply_query();
    
    function search() {
        console.log("sending find query");
        console.dir($scope.find);
        $http.get($scope.appconf.odi_api+"/exposures", {params: {
            find: $scope.find,
            skip: $scope.curpage*$scope.limit,
            limit: $scope.limit,
            select: 'logical_id type headers.OBSLOGIN headers.FILTER headers.PROGID headers.PROPID headers.TELFOCUS headers.NEXTEND headers.AIRMASS headers.ZD headers.DEC headers.RA', //TODO
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
        $location.path("/process");
    }
    $scope.done = function() {
        /*
        $http.put($scope.appconf.wf_api+'/instance/'+$scope.instance._id, $scope.instance).then(function(res) {
        //instance.save($scope.instance).then(function(_instance) {
            $location.path("/process");
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
        */
        $scope.save_instance(function() {
            $location.path("/process");
        });
    }
}]);

app.controller('CalibController', ['$scope', 'toaster', '$http', 'jwtHelper', 'scaMessage', 'instance', '$routeParams', '$location',
function($scope, toaster, $http, jwtHelper, scaMessage, instance, $routeParams, $location) {
    scaMessage.show(toaster);
    $scope.reset_urls($routeParams);
    instance.then(function(_instance) {
        //$scope.instance = _instance;
        if(!$scope.instance.config) $scope.instance.config = {};
        if(!$scope.instance.config.raws) $scope.instance.config.raws = {};
    });

    $scope.type = $routeParams.type;//bias, dark or flat
    $scope.curpage = 0;
    $scope.limit = 40;
    //$scope.query = "FILTER:odi_r";
    $scope.query = "";

    $scope.apply_query = function() {
        switch($scope.type) {
        case "flat":
            $scope.find = {"type": {$in: ["master_tflat", "master_dflat"]}}; 
            break;
        default:
            $scope.find = {"type": "master_"+$scope.type}; 
        }

        var queries = $scope.query.split(" ");
        queries.forEach(function(query) {
            var tokens = query.split(":");
            var key = "headers."+tokens[0];
            if(tokens.length == 2) $scope.find[key] = {$regex: tokens[1], $options: 'ix'}; 
        });
        $scope.curpage = 0;
        search();
    }
    $scope.apply_query();
    
    function search() {
        console.log("sending find query");
        console.dir($scope.find);
        $http.get($scope.appconf.odi_api+"/exposures", {params: {
            find: $scope.find,
            skip: $scope.curpage*$scope.limit,
            limit: $scope.limit,
            select: 'logical_id type headers.OBJECT headers.OBSLOGIN headers.FILTER headers.PROPID headers.PROGID headers.OBSTYPE headers.NEXTEND headers.EXPTIME headers.CAL-OBS', //TODO
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

        /*
        $http.put($scope.appconf.wf_api+'/instance/'+$scope.instance._id, $scope.instance).then(function(res) {
        //instance.save($scope.instance).then(function(_instance) {
            $location.path("/process");
        }, function(res) {
            if(res.data && res.data.message) toaster.error(res.data.message);
            else toaster.error(res.statusText);
        });
        */
        $scope.save_instance(function() {
            $location.path("/process");
        });
    }
    $scope.topage = function(page) {
        if(page < 0) return 1;
        if(page > $scope.count / $scope.limit) return 1;
        $scope.curpage = page;
        search();
    }
    $scope.back = function() {
        $location.path("/process");
    }
}]);

app.controller('TaskController', ['$scope', 'toaster', '$http', 'jwtHelper', 'scaMessage', 'instance', '$routeParams', '$location', 'scaTask',
function($scope, toaster, $http, jwtHelper, scaMessage, instance, $routeParams, $location, scaTask) {
    scaMessage.show(toaster);
    $scope.reset_urls($routeParams);

    $scope.taskid = $routeParams.taskid;
    $scope.jwt = localStorage.getItem($scope.appconf.jwt_id);

    $scope.task = scaTask.get($routeParams.taskid);
    $scope.task._promise.then(function() {
        if($scope.task.deps[0]) {
            $scope.qr_task = scaTask.get($scope.task.deps[0]);
        }
    });

    $scope.resource = null; //resource where this task is running/ran

    /*
    //need to keep watching until resource_id gets set
    $scope.$watchCollection('task', function(task) {
       //also load resource info
        if(task.resource_id && !$scope.resource) {
            $scope.resource = {}; //prevent double loading while I wait response from /resource
            $http.get($scope.appconf.wf_api+"/resource", {params: {
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
    */

    $scope.back = function() {
        $location.path("/process");
    }
}]);

//just a list of previously submitted tasks
app.controller('TasksController', ['$scope', 'menu', 'scaMessage', 'toaster', 'jwtHelper', '$http', '$location', '$routeParams', 'instance',
function($scope, menu,  scaMessage, toaster, jwtHelper, $http, $location, $routeParams, instance) {
    scaMessage.show(toaster);
    $scope.reset_urls($routeParams);

    //instance.then(function(_instance) { $scope.instance = _instance; });

    //load previously submitted tasks
    $http.get($scope.appconf.sca_api+"/task", {params: {
        where: {
            instance_id: $routeParams.instid,
            service: "soichih/sca-service-fits2png",
        }
    }})
    .then(function(res) {
        $scope.tasks = res.data;
    }, function(res) {
        if(res.data && res.data.message) toaster.error(res.data.message);
        else toaster.error(res.statusText);
    });

    $scope.open = function(task) {
        $location.path("/task/"+task._id);
    }
    $scope.back = function() {
        $location.path("/process");
    }
}]);

app.directive('scaProductDzi', ['toaster', '$http', '$timeout', 'appconf', 'scaTask',
function(toaster, $http, $timeout, appconf, scaTask) {
    return {
        restrict: 'E',
        scope: {
            taskid: '=',
        }, 
        templateUrl: 't/sca-product-dzi.html',
        link: function($scope, element) {
            var jwt = localStorage.getItem(appconf.jwt_id);
            $scope.task = scaTask.get($scope.taskid);
            $scope.task._promise.then(function() {
                var options = {
                    id: "osd."+$scope.task._id,
                    prefixUrl: "bower_components/openseadragon/built-openseadragon/openseadragon/images/",
                    //crossOriginPolicy: 'Anonymous', //needed by plugins to access getImageData()

                    showNavigator: true,
                    showRotationControl: true,
            
                    //make it a bit more snappy (default 1.2 sec)
                    animationTime: 0.2,

                    zoomPerScroll: 1.5, //increasing from default 1.2
            
                    //TODO - this causes pixel aliasing... I need to disable like jquery-tileviewer
                    maxZoomPixelRatio: 10,

                    sequenceMode: true,
                    showReferenceStrip: true,
                    tileSources: [],
                };

                $scope.task.products.forEach(function(product) {
                    if(product.type == "soichih/dzi") {
                        product.files.forEach(function(file) {
                            options.tileSources.push(
                                appconf.data_url+"/"+
                                $scope.task.instance_id+"/"+
                                $scope.task._id+"/"+
                                file.filename);//+"?at="+jwt);
                        });
                    }
                });
                console.log(JSON.stringify(options, null, 4));

                //TODO - I need to implement authorize api on odi service
                //and configure data service to trust it
                //right now, q6's /workflow is all open
                /*
                $http({
                    url: appconf.api+'/authorize',
                    method: 'POST',
                    data: {path: $scope.path}
                }).then(function(res) {
                    var jwt = res.data.access_token;
                });
                */

                //need to initialize after angular had time to apply task update
                //probably won't be necessary once I add a call to resource authorization api
                $timeout(function() {
                    var viewer = OpenSeadragon(options);
                }, 0);
            });  
        }
    };
}]);


