var WSLOGMESSAGE = {};

var common = {};

common.page = '';
common.form = '';
common.inlineform = '';
common.notifications = false;
common.data = {};
common.startmenu = false;
common.startmenuapps = true;

NAV.clientside('.jr');
SETTER(true, 'loading', 'hide', 500);

WATCH('common.page', function() {
	SETTER('inlineform', 'hide');
});

ON('resize', function() {
	var h = $(window).height();
	$('.scrollable').css('height', h - 50);
	$('.fullheight').each(function() {
		var el = $(this);
		el.css('height', h - (el.offset().top + 20));
	});
});

$(window).on('resize', function() {
	EMIT('resize');
});

ON('ready', function() {
	EMIT('resize');
});

function home() {
	SET('common.startmenu', false);
	SETTER('processes', 'minimize');
	REDIRECT('/');
}

AJAX('GET /api/meta/', 'common.meta');

function onImageError(image) {
	// image.onerror = null;
	image.src = '/img/empty.png';
	return true;
}

Tangular.register('photo', function(value) {
	return value ? ('/photos/' + value) : '/img/face.jpg';
});

Tangular.register('responsive', function(value) {
	return isMOBILE ? (value === true ? '' : ' app-disabled') : '';
});

$(window).on('message', function(e) {
	var data = JSON.parse(e.originalEvent.data);

	if (!data.openplatform)
		return;

	var app = dashboard.apps.findItem('accesstoken', data.accesstoken);
	if (!app || (!app.internal.internal && app.url.indexOf(data.origin) === -1))
		return;

	var processes = FIND('processes');

	switch (data.type) {

		case 'verify':
		case 'meta':
			if (app && navigator.userAgent === data.body.ua) {
				var iframe = processes.findProcess(app.id);
				var meta = CLONE(iframe.meta);
				meta.internal = undefined;
				meta.index = undefined;
				meta.running = undefined;
				meta.accesstoken = undefined;
				meta.data = common.data[app.id];
				meta.width = iframe.element.width();
				meta.height = iframe.iframe.height();
				meta.ww = WW;
				meta.wh = WH;
				meta.display = WIDTH();
				processes.message(iframe, 'verify', meta, data.callback);
				iframe.meta.href = undefined;
				if (data.type === 'verify') {
					setTimeout(function() {
						processes.notifyresize2(app.id);
					}, 100);
				}
			}
			break;

		case 'share':

			var err = '';
			var target = dashboard.apps.findItem('id', data.body.app);
			if (!target)
				err = 'Application not found (101)';
			else if (!target.running)
				err = 'Application is not running (102)';
			var iframe = processes.findProcess(app.id);
			data.callback && processes.message(iframe, 'share', null, data.callback, err);
			break;

		case 'maximize':
			app && processes.maximize(app.id);
			break;

		case 'focus':
			common.startmenu && SET('common.startmenu', false);
			app && processes.focus(app.id);
			break;

		case 'restart':

			if (app) {
				common.messages[app.id] = data.message;
				SETTER('loading', 'show');
				app.href = data.url;
				processes.kill(app.id);
				setTimeout(function() {
					SET('dashboard.current', app);
				}, 4000);
			}

			break;

		case 'loading':
			var iframe = processes.findProcess(app.id);
			iframe && iframe.element.find('.ui-process-loading').tclass('hidden', data.body !== true);
			break;

		case 'snackbar':
			SETTER('snackbar', data.body.type || 'success', data.body.body);
			break;

		case 'message':
			SETTER('message', data.body.type || 'success', '<div style="margin-bottom:10px;font-size:16px" class="b"><i class="fa fa-{0} mr5"></i>{1}</div>'.format(app.internal.icon, app.internal.title) + data.body.body);
			break;

		case 'confirm':
			SETTER('confirm', 'show', data.body.body, data.body.buttons, function(index) {
				var iframe = processes.findProcess(app.id);
				iframe && data.callback && processes.message(iframe, 'confirm', { index: index }, data.callback);
			});
			break;

		case 'play':
		case 'stop':
			SETTER('audio', data.type, data.body);
			break;

		case 'badge':
			if (!app || !app.internal.notifications)
				return;
			AJAX('GEt /api/badges/?accesstoken=' + app.accesstoken, NOOP);
			break;

		case 'notify':
			if (!app || !app.internal.notifications)
				return;
			AJAX('POST /api/notify/?accesstoken=' + app.accesstoken, data.body, NOOP);
			break;

		case 'minimize':
			app && processes.minimize();
			break;

		case 'log':
			WSLOGMESSAGE.TYPE = 'log';
			WSLOGMESSAGE.appid = app.id;
			WSLOGMESSAGE.appurl = app.url;
			WSLOGMESSAGE.body = data.body;
			SETTER('websocket', 'send', WSLOGMESSAGE);
			break;

		case 'open':
			common.data[data.body.id] = data.body.data;
			var el = $('.app[data-id="{0}"]'.format(data.body.id));
			el.length && el.trigger('click');
			break;

		case 'kill':
			app && processes.kill(app.id);
			break;
	}
});