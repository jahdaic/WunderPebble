/**
 * Welcome to Pebble.js!
 *
 * This is where you write your app.
 */

// INCLUDES
var UI = require('ui');
var ajax = require('ajax');
var Settings = require('settings');
var Vector2 = require('vector2');

// GLOBAL VARIABLE
var base = "https://api.wunderlist.com";
var reportingURL = "http://intrepidwebdesigns.com/WunderPebble/config/report.php"
var refreshed = 0;
var taskItems = 0;
var listsList = {inbox: 'Inbox', today: 'Today', week: 'Week'};

// CONFIGURATION
Settings.config(
	{
		url: "http://intrepidwebdesigns.com/WunderPebble/config/?email="+Settings.option('username')+"&password="+Settings.option('password')+"&reporting="+Settings.option('reporting')
	},
	function(e)
	{
		console.log('Open Configuration');	
	},
	function(e)
	{
		console.log('Closed Configuration');
		
		var data = JSON.parse(e.response);
		
		console.log(JSON.stringify(data));
		
		Settings.option('username', data.email);
		Settings.option('password', data.password);
		Settings.option('token', data.token);
		Settings.option('settings', data.data);
		Settings.option('reporting', data.data.errorReporting);
	}
);

// WINDOWS
var noConfig = new UI.Card(
{
	title: " WunderPebble",
	body: "\nOpen the Pebble App on your phone and configure the settings for this watchapp.",
	icon: 'images/icon.png',
	style: 'small'
});
var error = new UI.Card(
{
	title: " Error",
	body: "",
	icon: 'images/error.png',
	style: 'small',
	scrollable: true
});
var splash = new UI.Card({ banner: 'images/splash.png' });
var loading = new UI.Card({ banner: 'images/loading.png' });
var listMenu = new UI.Menu({sections: [{items:[]}]});
var taskMenu = new UI.Menu({sections: [{items:[]}]});
var task = new UI.Window({
	//action: {
	//	up: 'images/task-done.png',
	//	down: 'images/task-trash.png',
	//	backgroundColor: 'black'
	//},
	backgroundColor: 'white'
});

// ICON
var taskCheckbox = new UI.Image(
{
	position: new Vector2(7, 11),
	size: new Vector2(12, 12),
	image: 'images/task-checkbox.png'
});

var taskStar = new UI.Image(
{
	position: new Vector2(6, 2),
	size: new Vector2(14, 26),
	image: 'images/task-star.png'
});

// EVENT LISTENERS
noConfig.on('select', function(e)
{
	if(typeof Settings.option('token') !== 'undefined' && Settings.option('token') !== null)
	{
		try
		{
			getLists();
		}
		catch(err)
		{
			reportError(err);
		}
		
		listMenu.show();
		noConfig.hide();
	}
});

listMenu.on('select', function(e)
{
	console.log('Selected List Item: ' + e.item.title);
	
	loading.show();
	
	try
	{
		getTasks(e.item.id, e.item.title);
	}
	catch(err)
	{
		reportError(err);
	}
	
	onRefresh(function() {
		if(taskItems)
		{
			console.log('We have items');
			taskMenu.show();
			loading.hide();
		}
		else
		{
			console.log('No items');
			error.body("\nNo tasks were found for this list");
			error.show();
			loading.hide();
		}
		
		taskItems = 0;
	});
});

taskMenu.on('select', function(e)
{
	console.log('Selected Task: ' + e.item.title);
	
	displayTask(e.item.data);
	task.show();
});

//task.on('click', 'up', function(e) {
//	markTaskComplete(task.id);
//	getTasks(taskMenu.id, taskMenu.list);
//});

//task.on('click', 'down', function(e) {
//	deleteTask(task.id);
//	getTasks(taskMenu.id, taskMenu.list);
//});

// PROGRAM START
if(typeof Settings.option('token') !== 'undefined' && Settings.option('token') !== null)
{
	splash.show();
	
	try
	{
		getLists();
	}
	catch(err)
	{
		reportError(err);
	}
	
	onRefresh(function() {
		listMenu.show();
		splash.hide();
	});
}
else
{
	noConfig.show();
}

// DATA ACCESS FUNCTIONS
function getLists()
{
	ajax(
	{
		url: base + '/me/lists',
		type: 'json',
		method: 'get',
		headers: { Authorization: 'Bearer ' + Settings.option('token') }
	},
	function(data)
	{
		console.log('Lists Data: ' + JSON.stringify(data));
		
		var lists = [
			{
				title: 'Inbox',
				icon: 'images/inbox.png',
				id: 'inbox'
			},
			{
				title: 'Today',
				icon: 'images/today.png',
				id: 'today'
			},
			{
				title: 'Week',
				icon: 'images/week.png',
				id: 'week'
			}
		];
		
		for (var i = 0; i < data.length; i++)
		{
			var icon = 'images/list.png';//(data[i].local_identifier) ? 'images/group.png' : 'images/list.png';
			
			lists.push(
			{
				title: data[i].title,
				icon: icon,
				id: data[i].id
			});
			
			listsList[data[i].id] = data[i].title;
		}

		listMenu.items(0, lists);
		
		refreshed = 1;
		
		console.log('Done Getting Lists');
	},
	function(error) {
		console.log('Getting Lists Failed: ' + JSON.stringify(error));
	});
}

function getTasks(id, list)
{
	ajax(
	{
		url: base + '/me/tasks',
		type: 'json',
		method: 'get',
		headers: { Authorization: 'Bearer ' + Settings.option('token') }
	},
	function(data)
	{
		console.log('Tasks Data: ' + JSON.stringify(data));

		var tasks = [];
		
		var today = new Date();
		//today.setHours(0);
		//today.setMinutes(0);
		
		var tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		
		var yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		
		var timeZone = new Date().getTimezoneOffset() / 60 * 100;
		if(String(timeZone).length < 4) timeZone = '0' + timeZone;
		if(timeZone.slice(2, 3) == '5') timeZone = timeZone.slice(0, 2) + "3" + timeZone.slice(3);
		timeZone = (Number(timeZone) < 0) ? ('+' + timeZone) : ('-' + timeZone);
		timeZone = timeZone.slice(0, 3) + ":" + timeZone.slice(3);
		
		if(id == 'today')
		{
			for (var i = 0; i < data.length; i++)
			{
				if(data[i].due_date && data[i].title)
				{
					var dateString = data[i].due_date + 'T00:00' + timeZone;
					var date = new Date(dateString);
					
					if(date.getTime() <= today.getTime() && data[i].completed_at === null)
					{
						taskItems++;
						
						if(date.toDateString() == today.toDateString())
							date = 'Today';
						else if(date.toDateString() == tomorrow.toDateString())
							date = 'Tomorrow';
						else if(date.toDateString() == yesterday.toDateString())
							date = 'Yesterday';
						else
						{
							date = date.toISOString().slice(0, 10).split('-');
							date = date[1] + '.' + date[2] + '.' + date[0];
						}
						
						var icon = (data[i].starred) ? 'images/star.png' : 'images/task.png';

						tasks.push(
						{
							title: data[i].title,
							subtitle: date,
							icon: icon,
							data: data[i]
						});
					}
				}
			}
		}
		else if(id == 'week')
		{
			for (var i = 0; i < data.length; i++)
			{
				if(data[i].due_date && data[i].title)
				{
					var dateString = data[i].due_date + 'T00:00' + timeZone;
					var date = new Date(dateString);
					
					// Rework to show 7 days to future, maybe divide by day/section
					if((date.getWeek() == today.getWeek() || date.getTime() <= today.getTime()) && data[i].completed_at === null)
					{
						taskItems++;
						
						if(date.toDateString() == today.toDateString())
							date = 'Today';
						else if(date.toDateString() == tomorrow.toDateString())
							date = 'Tomorrow';
						else if(date.toDateString() == yesterday.toDateString())
							date = 'Yesterday';
						else
						{
							date = date.toISOString().slice(0, 10).split('-');
							date = date[1] + '.' + date[2] + '.' + date[0];
						}
						
						var icon = (data[i].starred) ? 'images/star.png' : 'images/task.png';

						tasks.push(
						{
							title: data[i].title,
							subtitle: listsList[data[i].list_id],
							icon: icon,
							data: data[i]
						});
					}
				}
			}
		}
		else
		{
			for (var i = 0; i < data.length; i++)
			{
				if(data[i].list_id == id && data[i].completed_at === null && data[i].deleted_at === null && data[i].parent_id === null)
				{
					taskItems++;
					
					var dateString = data[i].due_date + 'T00:00' + timeZone;
					var date = new Date(dateString);
					
					if(!data[i].due_date)
						date = '';
					else if(date.toDateString() == today.toDateString())
						date = 'Today';
					else if(date.toDateString() == tomorrow.toDateString())
						date = 'Tomorrow';
					else if(date.toDateString() == yesterday.toDateString())
							date = 'Yesterday';
					else
					{
						date = date.toISOString().slice(0, 10).split('-');
						date = date[1] + '.' + date[2] + '.' + date[0];
					}
					
					var icon = (data[i].starred) ? 'images/star.png' : 'images/task.png';

					tasks.push(
					{
						title: data[i].title,
						subtitle: date,
						icon: icon,
						data: data[i]
					});	
				}
			}
		}

		taskMenu.section(0, {title: list, items: []});
		taskMenu.items(0, tasks);
		taskMenu.id = id;
		taskMenu.list = list;
		
		refreshed = 1;
		
		console.log('Done Getting '+ taskItems +' Tasks');
	},
	function(error) {
		console.log('Getting Tasks Failed: ' + JSON.stringify(error));
	});
}

function displayTask(data)
{
	// Clear Window
	task.each(function(element) {
		task.remove(element);
	});
	
	var timeZone = new Date().getTimezoneOffset() / 60 * 100;
	if(String(timeZone).length < 4) timeZone = '0' + timeZone;
	if(timeZone.slice(2, 3) == '5') timeZone = timeZone.slice(0, 2) + "3" + timeZone.slice(3);
	timeZone = (Number(timeZone) < 0) ? ('+' + timeZone) : ('-' + timeZone);
	timeZone = timeZone.slice(0, 3) + ":" + timeZone.slice(3);
	
	var dateString = data.due_date + 'T00:00' + timeZone;
	var displayDate = new Date(dateString);
	
	var today = new Date();

	var tomorrow = new Date();
	tomorrow.setDate(tomorrow.getDate() + 1);
	
	var yesterday = new Date();
	yesterday.setDate(yesterday.getDate() - 1);
	
	if(!data.due_date)
		displayDate = '';
	else if(displayDate.toDateString() == today.toDateString())
		displayDate = 'Due Today';
	else if(displayDate.toDateString() == tomorrow.toDateString())
		displayDate = 'Due Tomorrow';
	else if(displayDate.toDateString() == yesterday.toDateString())
		displayDate = 'Due Yesterday';
	else
	{
		displayDate = displayDate.toDateString().split(' ');
		displayDate = 'Due on ' + displayDate[1] + ' ' + Number(displayDate[2]) + ', ' + displayDate[3];
	}	
	
	var bg = new UI.Image(
	{
		position: new Vector2(0, 0),
		image: 'images/task-bg.png'
	});
	
	var icon = (data.starred) ? taskStar : taskCheckbox;
	
	var title = new UI.Text(
	{
		position: new Vector2(24, 0),
		size: new Vector2(100, 30),
		font: 'gothic-14-bold',
		text: data.title,
		textOverflow: 'ellipsis',
		color: 'black',
		textAlign: 'left'
	});

	var date = new UI.Text(
	{
		position: new Vector2(24, 30),
		size: new Vector2(100, 30),
		font: 'gothic-14',
		text: displayDate,
		color: 'black',
		textAlign: 'left'
	});
	
	var note = new UI.Text(
	{
		position: new Vector2(5, 46),
		size: new Vector2(114, 100),
		font: 'gothic-14',
		text: (data.note) ? data.note : '',
		textOverflow: 'ellipsis',
		color: 'black',
		textAlign: 'left'
	});
	
	task.add(bg);
	task.add(icon);
	task.add(title);
	task.add(date);
	task.add(note);
	
	task.id = data.id;
	task.data = data;
}

function completeTask(id)
{
	var date = new Date().toISOString();
	date = date.slice(0, date.indexOf('T'));
	
	ajax(
	{
		url: base + '/me/' + id,
		type: 'json',
		method: 'put',
		headers: { Authorization: 'Bearer ' + Settings.option('token') },
		data: {completed_at: date}
	},
	function(data)
	{
		console.log('Task Data: ' + JSON.stringify(data));
		
		
		
		console.log('Marked Task Complete');
	},
	function(error) {
		console.log('Completing Task Failed: ' + JSON.stringify(error));
	});
}

function deleteTask(id)
{
	var date = new Date().toISOString();
	date = date.slice(0, date.indexOf('T'));
	
	console.log(base + '/me/' + id);
	
	ajax(
	{
		url: base + '/me/' + id,
		type: 'json',
		method: 'delete',
		headers: { Authorization: 'Bearer ' + Settings.option('token') }
	},
	function(data)
	{
		console.log('Task Data: ' + JSON.stringify(data));
		
		
		
		console.log('Deleted Task');
	},
	function(error) {
		console.log('Deleting Task Failed: ' + JSON.stringify(error));
	});
}


// UTILITY FUNCTIONS
function onRefresh(callback)
{
	setTimeout(function()
	{
		if(refreshed)
		{
			callback();
			refreshed = 0;
		}
		else
		{
			onRefresh(callback);
		}
	}, 200);
}

function reportError(error)
{
	if(Settings.option('reporting'))
	{
		ajax(
		{
			url: reportingURL,
			type: 'string',
			method: 'post',
			data: {error: error}
		},
		function(data)
		{
			console.log('Error Reported');


			console.log(data);
		},
		function(error) {
			console.log('Error Report Failed');
		});
	}
	else
		return false;
}

Date.prototype.getWeek = function()
{ 
    var determinedate = new Date(); 
    determinedate.setFullYear(this.getFullYear(), this.getMonth(), this.getDate()); 
    var D = determinedate.getDay(); 
    if(D === 0) D = 7; 
    determinedate.setDate(determinedate.getDate() + (4 - D)); 
    var YN = determinedate.getFullYear(); 
    var ZBDoCY = Math.floor((determinedate.getTime() - new Date(YN, 0, 1, -6)) / 86400000); 
    var WN = 1 + Math.floor(ZBDoCY / 7); 
    return WN; 
};