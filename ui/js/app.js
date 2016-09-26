'use strict';

var app = angular.module('app', [
    'app.config',
    'ngRoute',
    'ngCookies',
    'ngAnimate',
    'toaster',
    'angular-loading-bar',
    'angular-jwt',
    'ui.bootstrap',
    'ui.bootstrap.tabs',
    'ui.select',
    'ui.gravatar',
//    'angular.filter',
    'sca-shared',
    'sca-ng-wf',
    'sca-product-raw',
    'sca-product-odi',
    'yaru22.angular-timeago'
]);

//show loading bar at the page top
app.config(['cfpLoadingBarProvider', function(cfpLoadingBarProvider) {
    cfpLoadingBarProvider.includeSpinner = false;
}]);

//can't quite do the slidedown animation through pure angular/css.. borrowing slideDown from jQuery..
app.animation('.slide-down', ['$animateCss', function($animateCss) {
    return {
        enter: function(elem, done) {
            $(elem).hide().slideDown("normal", done);
        },
        leave: function(elem, done) {
            $(elem).slideUp("normal", done);
        }
    };
}]);

//configure route
app.config(['$routeProvider', 'appconf', function($routeProvider, appconf) {
    $routeProvider
    .when('/start', {
        template: '',
        controller: 'StartController',
        requiresLogin: true
    })

    .when('/process', {
        templateUrl: 't/process.html',
        controller: 'ProcessController',
        requiresLogin: true
    })
    .when('/input', {
        templateUrl: 't/input.html',
        controller: 'InputController',
        requiresLogin: true
    })
    .when('/calib/:type', {
        templateUrl: 't/calib.html',
        controller: 'CalibController',
        requiresLogin: true
    })

    .when('/tasks', {
        templateUrl: 't/tasks.html',
        controller: 'TasksController',
        requiresLogin: true
    })
    .when('/task/:taskid', {
        templateUrl: 't/task.html',
        controller: 'TaskController',
        requiresLogin: true
    })
    .otherwise({
        redirectTo: '/start'
    })
    ;
}]).run(['$rootScope', '$location', 'toaster', 'jwtHelper', 'appconf', 'scaMessage',
function($rootScope, $location, toaster, jwtHelper, appconf, scaMessage) {
    $rootScope.$on("$routeChangeStart", function(event, next, current) {
        //redirect to /login if user hasn't authenticated yet
        if(next.requiresLogin) {
            var jwt = localStorage.getItem(appconf.jwt_id);
            if(jwt == null || jwtHelper.isTokenExpired(jwt)) {
                sessionStorage.setItem('auth_redirect', document.location.toString());
                scaMessage.info("Please signin first!");
                document.location = appconf.auth_url;
                event.preventDefault();
            }
        }
    });
}]);

//configure httpProvider to send jwt unless skipAuthorization is set in config (not tested yet..)
app.config(['appconf', '$httpProvider', 'jwtInterceptorProvider', 
function(appconf, $httpProvider, jwtInterceptorProvider) {
    jwtInterceptorProvider.tokenGetter = function(jwtHelper, config, $http, toaster) {
        //don't send jwt for template requests
        //(I don't think angular will ever load css/js - browsers do)
        if (config.url.substr(config.url.length - 5) == '.html') { return null; }
        return localStorage.getItem(appconf.jwt_id);
    }
    $httpProvider.interceptors.push('jwtInterceptor');
}]);

app.factory('instance', function(appconf, $http, jwtHelper, toaster) {
    console.log("getting test instance");
    var workflow_id = "sca-wf-qr"; //needs to match package.json/name
    return $http.get(appconf.wf_api+'/instance', {
        params: {
            find: { workflow_id: workflow_id }
        }
    }).then(function(res) {
        if(res.data.count != 0) {
            return res.data.instances[0];
        } else {
            console.log("creating new instance");
            //need to create one
            return $http.post(appconf.wf_api+"/instance", {
                workflow_id: workflow_id,
                name: "test",
                desc: "singleton",
                config: {some: "thing"},
            }).then(function(res) {
                console.log("created new instance");
                return res.data;
            }, function(res) {
                if(res.data && res.data.message) toaster.error(res.data.message);
                else toaster.error(res.statusText);
            });
        }
    }, function(res) {
        if(res.data && res.data.message) toaster.error(res.data.message);
        else toaster.error(res.statusText);
    });

    /*
    return {
        promise: promise,
        save: function(_instance) {
            console.log("saving instance");
            console.dir(_instance);
            return $http.put(appconf.wf_api+'/instance/'+_instance._id, _instance);
        }
    }
    */
});

app.factory('menu', ['appconf', '$http', 'jwtHelper', '$sce', 'scaMessage', 'scaMenu', 'toaster',
function(appconf, $http, jwtHelper, $sce, scaMessage, scaMenu, toaster) {
    var jwt = localStorage.getItem(appconf.jwt_id);
    var menu = {
        /*
        header: {
            //label: appconf.title,
            //icon: $sce.trustAsHtml("<img src=\""+appconf.icon_url+"\">"),
            //url: "#/",
        },
        */
        top: scaMenu,
        user: null, //to-be-loaded
        //_profile: null, //to-be-loaded
    };

    var jwt = localStorage.getItem(appconf.jwt_id);
    if(jwt) {
        var expdate = jwtHelper.getTokenExpirationDate(jwt);
        var ttl = expdate - Date.now();
        if(ttl < 0) {
            toaster.error("Your login session has expired. Please re-sign in");
            localStorage.removeItem(appconf.jwt_id);
        } else {
            menu.user = jwtHelper.decodeToken(jwt);
            if(ttl < 3600*1000) {
                //jwt expring in less than an hour! refresh!
                console.log("jwt expiring in an hour.. refreshing first");
                $http({
                    url: appconf.auth_api+'/refresh',
                    //skipAuthorization: true,  //prevent infinite recursion
                    //headers: {'Authorization': 'Bearer '+jwt},
                    method: 'POST'
                }).then(function(response) {
                    var jwt = response.data.jwt;
                    localStorage.setItem(appconf.jwt_id, jwt);
                    menu.user = jwtHelper.decodeToken(jwt);
                });
            }
        }
    }
    return menu;
}]);

//http://plnkr.co/edit/juqoNOt1z1Gb349XabQ2?p=preview
/**
 * AngularJS default filter with the following expression:
 * "person in people | filter: {name: $select.search, age: $select.search}"
 * performs a AND between 'name: $select.search' and 'age: $select.search'.
 * We want to perform a OR.
 */
app.filter('propsFilter', function() {
    return function(items, props) {
        var out = [];
        if (angular.isArray(items)) {
            items.forEach(function(item) {
                var itemMatches = false;
                var keys = Object.keys(props);
                for (var i = 0; i < keys.length; i++) {
                    var prop = keys[i];
                    var text = props[prop].toLowerCase();
                    if (item[prop].toString().toLowerCase().indexOf(text) !== -1) {
                        itemMatches = true;
                        break;
                    }
                }

                if (itemMatches) {
                    out.push(item);
                }
            });
        } else {
            // Let the output be the input untouched
            out = items;
        }
        return out;
    };
});

/*
app.filter('toArray', function() { return function(obj) {
    if (!(obj instanceof Object)) return obj;
    return _.map(obj, function(val, key) {
        return Object.defineProperty(val, '$key', {__proto__: null, value: key});
    });
}});
*/

//http://stackoverflow.com/questions/14852802/detect-unsaved-changes-and-alert-user-using-angularjs
app.directive('confirmOnExit', function() {
    return {
        //scope: { form: '=', },
        link: function($scope, elem, attrs) {
            window.onbeforeunload = function(){
                if ($scope.form.$dirty) {
                    return "You have unsaved changes.";
                }
            }
            $scope.$on('$locationChangeStart', function(event, next, current) {
                if ($scope.form.$dirty) {
                    if(!confirm("Do you want to abondon unsaved changes?")) {
                        event.preventDefault();
                    }
                }
            });
        }
    };
});

app.directive('uiSelectRequired', function() {
  return {
    require: 'ngModel',
    link: function(scope, elm, attrs, ctrl) {
      ctrl.$validators.uiSelectRequired = function(modelValue, viewValue) {

        var determineVal;
        if (angular.isArray(modelValue)) {
          determineVal = modelValue;
        } else if (angular.isArray(viewValue)) {
          determineVal = viewValue;
        } else {
          return false;
        }

        return determineVal.length > 0;
      };
    }
  };
});

/*
app.directive('bread', function() {
    return {
        templateUrl: 't/bread.html',
        restrict: 'E',
        scope: {
            instid: '=',
            breads: '=',
            active: '=',
        },
        link: function($scope, elm, attrs, ctrl) {
            $scope.click = function(bread) {
                document.location = bread.url.replace(":instid", $scope.instid);
            }
        },
    }
});
*/
