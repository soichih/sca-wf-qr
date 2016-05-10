angular.module('app.config', [])
.constant('appconf', {

    //api to query for odi images
    odi_api: '/api/odi',

    //shared servive api and ui urls (for menus and stuff)
    shared_api: '/api/shared',
    shared_url: '/shared',

    //authentcation service API to refresh token, etc.
    auth_api: '/api/auth',
    auth_url: '/auth',

    sca_api: '/api/sca',
    upload_api: '/api/upload',

    progress_api: '/api/progress',
    progress_url: '/progress#/detail/',

    jwt_id: 'jwt',
    upload_task_id: 'upload',

    breads: [
        {id: "workflows", label: "Workflows", url:"/sca/#/workflows" },
        {id: "process", label: "Process" },
        {id: "input", label: "Add Input" },
        {id: "taskis", label: "Tasks" },
    ]
});

