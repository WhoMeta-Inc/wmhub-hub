NEWSCHEMA('Notification', function(schema) {

	schema.define('type', Number);
	schema.define('body', 'String(1000)', true);
	schema.define('data', 'String(1000)');

	schema.setQuery(function($) {

		var user = $.user;

		//if (!user.countnotifications) {
		//	$.callback(EMPTYARRAY);
		//	return;
		//}

		FUNC.notifications.get(user.id, function(err, data) {

			// Remove notifications
			FUNC.notifications.rem(user.id, function() {
				OP.session.release2(user.id, function(err, count) {
					count && FUNC.emit('users.notify', user.id, '', true);
				});
			});

			// Returns notifications
			$.callback(data || []);
		});
	});

	schema.setSave(function($) {

		OP.decodeToken($.query.accesstoken, function(err, obj) {

			if (!obj) {
				$.invalid('error-invalid-accesstoken');
				return;
			}

			var ip = $.ip;
			var user = obj.user;
			var app = obj.app;

			if (app.origin) {
				if (app.origin.indexOf(ip) == -1 && app.hostname !== ip && (!$.user || $.user.id !== user.id)) {
					$.invalid('error-invalid-origin');
					return;
				}
			} else if (app.hostname !== ip && (!$.user || $.user.id !== user.id)) {
				$.invalid('error-invalid-origin');
				return;
			}

			if (!app.allownotifications) {
				$.invalid('error-permissions');
				return;
			}

			if (!user.notifications || user.blocked || user.inactive) {
				$.invalid('error-accessible');
				return;
			}

			var model = $.clean();
			model.id = UID('notifications');
			model.userid = user.id;
			model.appid = app.id;
			model.dtcreated = NOW;
			model.ip = $.ip;

			if (user.online) {
				if (MAIN.quicknotifications[model.userid])
					MAIN.quicknotifications[model.userid].push(model);
				else
					MAIN.quicknotifications[model.userid] = [model];
			}

			var can = true;

			if (app && user.apps[app.id]) {
				var ua = user.apps[app.id];

				if (ua.notifications === false) {
					$.invalid('error-notifications-muted');
					return;
				}

				if (ua.countnotifications)
					ua.countnotifications++;
				else
					ua.countnotifications = 1;

				if (ua.countnotifications > 15)
					can = false;
			}

			if (user.countnotifications)
				user.countnotifications++;
			else
				user.countnotifications = 1;

			user.dtnotified = NOW;

			if (can) {

				// Adds notification
				FUNC.notifications.add(model);

				// Updates session
				OP.session.set2(user.id, user);

				// LAST NOTIFICATIONS


				// Updates profile
				FUNC.users.set(user, ['countnotifications', 'apps', 'dtnotified'], () => FUNC.emit('users.notify', user.id, app.id), app, 'notify');
			}

			$.success();
		});
	});
});