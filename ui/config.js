angular.module('app.config', [])
.constant('appconf', {

    //api to query for odi images
    odi_api: '/api/odi',

    data_url: 'https://q6.sca.iu.edu/data/workflows',

    //shared servive api and ui urls (for menus and stuff)
    shared_api: '/api/shared',
    shared_url: '/shared',

    //authentcation service API to refresh token, etc.
    auth_api: '/api/auth',
    auth_url: '/auth',

    sca_api: '/api/wf',//deprecated but still used by some sca-wf shared component
    wf_api: '/api/wf',

    progress_api: '/api/progress',
    progress_url: '/progress',

    jwt_id: 'jwt',
    upload_task_id: 'upload',

    breads: [
        {id: "workflows", label: "Workflows", url:"/wf/#/workflows" },
        {id: "process", label: "Process" },
        {id: "tasks", label: "Tasks" },
    ]
});

