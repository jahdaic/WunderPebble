/**
 * WunderPebble
 * By: Jahdai Cintron
 * http://jahdaicintron.com/wunderpebble
 */
// DEBUGGING
var DEBUG = false;
var VERSION = 1.2;

// INCLUDES
var UI       = require( "ui" );
var ajax     = require( "ajax" );
var Settings = require( "settings" );
var Vector2  = require( "vector2" );

// GLOBAL VARIABLES
var api           = "https://a.wunderlist.com/api/v1";
var clientID      = "4d4eece3b87fd2a63a2d";
var header        = { "X-Access-Token": Settings.option( "token" ), "X-Client-ID": clientID, contentType: "application/json;" };
var reporting     = "http://jahdaicintron.com/wunderpebbleconfig/report.php";
var taskItems     = 0;
var shares        = [];
var folders       = {};
var listPositions = [];
var taskPositions = [];
var folderLists   = {};
var listsList     = { inbox: "Inbox", today: "Today", week: "Week" };
var days          = [ "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday" ];
var months        = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
var monthsShort   = [ "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" ];
var today;
var tomorrow;
var yesterday;
var timeZone;


// CONFIGURATION
Settings.config(
	{
		url: "http://jahdaicintron.com/wunderpebbleconfig/?token=" + Settings.option( "token" ) + "&reporting=" + Settings.option( "reporting" ) + "&email=" + Settings.option( "email" )
	},
	function( e )
	{
		console.log( "Open Configuration" );
	},
	function( e )
	{
		console.log( "Closed Configuration" );
		
		var data = JSON.parse( e.response );
		
		console.log( JSON.stringify( data ) );
		
		Settings.option( "email", "" );
		Settings.option( "reporting", true );
		Settings.option( "settings", data );
		
		if( "access_token" in data ) Settings.option( "token", data.access_token );

		header = { "X-Access-Token": Settings.option( "token" ), "X-Client-ID": clientID, contentType: "application/json; charset=utf-8" };

		getUserData();
	}
);

// WINDOWS
var noConfig = new UI.Card(
{
	title: " WunderPebble",
	body:  "\nOpen the Pebble App on your phone and configure the settings for this watchapp.",
	icon:  "images/icon.png",
	style: "small"
});
var error = new UI.Card(
{
	title: " Error",
	body:  "",
	icon:  "images/error.png",
	style: "small",
	scrollable: true
});
var splash = new UI.Card( { banner: "images/splash.png" } );
var loading = new UI.Card( { banner: "images/loading.png" } );
var listMenu = new UI.Menu( {sections: [{items:[]}] } );
var sublistMenu = new UI.Menu( {sections: [{items:[]}] } );
var taskMenu = new UI.Menu( {sections: [{items:[]}] } );
var task = new UI.Window({
	//action: {
	//	up: "images/task-done.png",
	//	down: "images/task-trash.png",
	//	backgroundColor: "black"
	//},
	backgroundColor: "white"
});

// ICONS
var taskCheckbox = new UI.Image(
{
	position: new Vector2( 7, 11 ),
	size:     new Vector2( 12, 12 ),
	image:    "images/task-checkbox.png"
});

var taskStar = new UI.Image(
{
	position: new Vector2( 6, 2 ),
	size:     new Vector2( 14, 26 ),
	image:    "images/task-star.png"
});

// EVENT LISTENERS
noConfig.on( "select", programStart );

listMenu.on( "select", function( e ) {
	console.log( "Viewing Tasks For: " + e.item.title );
	
	loading.show();
	
	try
	{
		if(e.item.type == 'folder')
		{
			getLists( e.item.id, function() {
				sublistMenu.show();
				loading.hide();
			});
		}
		else
		{
			getTaskPositions( e.item.id, function() {
				getTasks( e.item.id, e.item.title, function() {
					if( taskItems )
					{
						taskMenu.show();
						loading.hide();
					}
					else
					{
						error.body( "\nNo tasks were found for this list" );
						error.show();
						loading.hide();
					}
					
					taskItems = 0;
				});
			});
		}
	}
	catch( err )
	{
		reportError( "List Selected: " + err.message );
	}
});

sublistMenu.on( "select", function( e ) {
	console.log( "Viewing Tasks For: " + e.item.title );
	
	loading.show();
	
	try
	{
		getTaskPositions( e.item.id, function() {
			getTasks( e.item.id, e.item.title, function() {
				if( taskItems )
				{
					taskMenu.show();
					loading.hide();
				}
				else
				{
					error.body( "\nNo tasks were found for this list" );
					error.show();
					loading.hide();
				}
				
				taskItems = 0;
			});
		});
	}
	catch( err )
	{
		reportError( "List Selected: " + err.message );
	}
});

taskMenu.on( "select", function( e ) {
	if(DEBUG) console.log( "Selected Task: " + e.item.title );
	
	try
	{
		getTask( e.item.data );
	}
	catch( err )
	{
		reportError( "Task Selected: " + err.message );
	}	
});

// PROGRAM START
function programStart()
{
	if( typeof Settings.option( "token" ) !== "undefined" && Settings.option( "token" ) !== null )
	{
		splash.show();
		noConfig.hide();

		if( Settings.data( "user" ) === null )
			getUserData();

		try
		{
			getListPositions( function() {
				getShares( function() {
					getLists( null, function() {
						listMenu.show();
						splash.hide();
					});
				});
			});
		}
		catch( err )
		{
			reportError( "Program Start: " + err.message );
		}
	}
	else
	{
		noConfig.show();
	}
}

programStart();


// DATA ACCESS FUNCTIONS
function getLists( folder, callback )
{
	if(DEBUG) console.log( "Getting Folders" );

	ajax(
	{
		url:     api + "/folders",
		type:    "json",
		method:  "get",
		headers: header,
		cache:   false
	},
	function( data )
	{
		folderLists = {};

		for ( var i = 0; i < data.length; i++ )
		{
			folders[ data[i].id ] = data[i];

			for ( var j = 0; j < data[i].list_ids.length; j++ )
			{
				folderLists[ data[i].list_ids[j] ] = data[i].id;
			}
		}

		if(DEBUG) console.log( "Folders: " + JSON.stringify( folders ) );	
		if(DEBUG) console.log( "Folder List: " + JSON.stringify( folderLists ) );	

		if(DEBUG) console.log( "Getting Lists" );	
		
		ajax(
		{
			url:     api + "/lists",
			type:    "json",
			method:  "get",
			headers: header,
			cache:   false
		},
		function( data )
		{
			if(DEBUG) console.log( "Lists: " + JSON.stringify( data ) );
			if(DEBUG) console.log( "Got Lists" );

			var lists = data;

			if( folder === null )
			{
				displayLists( lists, false );
			}
			else
			{
				for ( var i = 0; i < lists.length; i++ )
				{					
					if( folders[ folder ].list_ids.indexOf( lists[i].id ) == -1 )
					{
						lists.splice( i, 1 );
						i--;
					}
				}

				console.log( "Lists for Folder: " + JSON.stringify( lists ) );

				displayLists( lists, folders[ folder ].title );
			}

			if( typeof callback !== "undefined" ) callback();
		},
		function( error )
		{
			if(DEBUG) console.log( "Getting Lists Failed: " + JSON.stringify( error ) );		
			reportError( "Getting Lists: " + JSON.stringify( error ) );
		});
	},
	function( error )
	{
		if(DEBUG) console.log( "Getting Folders Failed: " + JSON.stringify( error ) );		
		reportError( "Getting Folders: " + JSON.stringify( error ) );
	});
}

function displayLists( lists, sublist )
{
	if(DEBUG) console.log( "Displaying Lists" );
	
	try
	{
		var menu = [];

		if( !sublist )
		{
			var menu = [
				{
					title: "Inbox",
					icon: "images/inbox.png",
					id: "inbox",
					type: "list"
				},
				{
					title: "Today",
					icon: "images/today.png",
					id: "today",
					type: "smartlist"
				},
				{
					title: "Week",
					icon: "images/week.png",
					id: "week",
					type: "smartlist"
				}
			];
		}

		var foldersAdded = [];

		for ( var i = 0; i < lists.length; i++ )
		{
			if( lists[i].title == "inbox" )
			{
				menu[0].id = lists[i].id;
				listsList[ lists[i].id ] = "Inbox";
			}
			else if( lists[i].id in folderLists && !sublist )
			{
				if( foldersAdded.indexOf( folders[ folderLists[ lists[i].id ] ].id ) != -1 )
					continue;

				menu.push(
				{
					title:    folders[ folderLists[ lists[i].id ] ].title,
					icon:     "images/folder.png",
					id:       folders[ folderLists[ lists[i].id ] ].id,
					position: listPositions.indexOf( lists[i].id ),
					type: "folder"
				});

				foldersAdded.push( folders[ folderLists[ lists[i].id ] ].id );
			}
			else
			{
				menu.push(
				{
					title:    lists[i].title,
					icon:     ( shares.indexOf( lists[i].id ) > -1 ) ? "images/group.png" : "images/list.png",
					id:       lists[i].id,
					position: listPositions.indexOf( lists[i].id ),
					type: "list"
				});

				listsList[ lists[i].id ] = lists[i].title;
			}
		}

		menu.sort( sortItems );

		if( sublist )
			sublistMenu.section(0, {title: sublist, items: menu});
			// sublistMenu.items( 0, menu );
		else
			listMenu.items( 0, menu );

		if(DEBUG) console.log( "Displayed Lists" );
	}
	catch( err )
	{
		reportError( "Displaying Lists: " + err.message );
	}
}

function getTasks( id, list, callback )
{	
	if(DEBUG) console.log( "Gettings Tasks" );	

	if( !isNaN( id ) )
	{
		ajax(
		{
			url:     api + "/tasks?list_id=" + id + "&completed=false",
			type:    "json",
			method:  "get",
			headers: header,
			cache:   false
		},
		function( data )
		{
			try
			{
				displayTasks( id, list, data );

				if( typeof callback !== "undefined" ) callback();
			}
			catch( err )
			{
				reportError( "Getting Tasks: " + err.message );
			}
		},
		function( err )
		{
			console.log( "Getting Tasks Failed: " + JSON.stringify( err ) );
			reportError( "Getting Tasks: " + JSON.stringify( err ) );
		});
	}
	else
	{
		var tasks = [];
	
		var semaphore = 0;
		
		for ( var i = 0; i < listPositions.length; i++ )
		{
			semaphore++;
			if(DEBUG) console.log( "Running Task: "+ semaphore );
			
			ajax(
			{
				url:     api + "/tasks?list_id=" + listPositions[i] + "&completed=false",
				type:    "json",
				method:  "get",
				headers: header,
				cache:   false
			},
			function( data )
			{
				try
				{
					if( data.length > 0 ) tasks = tasks.concat( data );
				}
				catch( err )
				{
					reportError( "Getting Shares: " + err.message );
				}
				finally
				{
					semaphore--;
					if(DEBUG) console.log( "Ending Task, " + semaphore + " Left" );

					if( semaphore === 0 )
					{
						displayTasks( id, list, tasks );
						if( typeof callback !== "undefined" ) callback();
					}					
				}
			},
			function( err )
			{
				console.log( "Getting All Tasks Failed: " + JSON.stringify( err ) );
				
				if( err.type != "permission_error" )
				{
					reportError( "Getting All Tasks: " + JSON.stringify( err ) );
				}
				
				semaphore--;
				if(DEBUG) console.log( "Ending Task, " + semaphore + " Left" );

				if( semaphore === 0 )
				{
					displayTasks( id, list, tasks );
					if( typeof callback !== "undefined" ) callback();
				}
			});
		}
	}
}

function displayTasks( id, list, tasks )
{
	if(DEBUG) console.log( "Tasks: " + JSON.stringify( tasks ) );
	if(DEBUG) console.log( "Got " + tasks.length + " Tasks" );
	if(DEBUG) console.log( "Displaying Tasks" );

	today = new Date();

	tomorrow = new Date();
	tomorrow.setDate( tomorrow.getDate() + 1 );

	yesterday = new Date();
	yesterday.setDate( yesterday.getDate() - 1 );

	timeZone = new Date().toTimeString().slice( 12, 17 );
	timeZone = String( timeZone ).slice( 0, 3 ) + ":" + String( timeZone ).slice( 3 );

	var menuItems;

	if( id == "today" )
		menuItems = displayTodayTasks( tasks );
	else if( id == "week" )
		menuItems = displayWeekTasks( tasks );
	else
		menuItems = displayListTasks( tasks, list );

	taskMenu = new UI.Menu( menuItems );
	taskMenu.id = id;
	taskMenu.list = list;
	
	if(DEBUG) console.log( "Displaying Task List Object" );
	if(DEBUG) console.log( JSON.stringify( taskMenu ) );

	taskMenu.on( "select", function( e )
	{
		if(DEBUG) console.log( "Viewing Task: " + e.item.title );

		try
		{
			getTask( e.item.data );
		}
		catch( err )
		{
			reportError( "Task Selected: " + err.message );
		}
	});

	taskMenu.on( "longSelect", function( e )
	{
		try
		{
			completeTask( e );
		}
		catch( err )
		{
			reportError( "Marked Task Complete: " + err.message );
		}
	});

	if(DEBUG) console.log( "Displayed " + taskItems + " Tasks" );
}

function displayTodayTasks( tasks )
{
	if(DEBUG) console.log( "Displaying Today Tasks" );

	var taskSections = { sections: [] };						
	var sectionsList = [];

	for ( var i = 0; i < tasks.length; i++ )
	{
		if( tasks[i].due_date && tasks[i].title )
		{
			var date = new Date( tasks[i].due_date + "T00:00" + timeZone );

			if( date.getTime() <= today.getTime() )
			{
				taskItems++;

				var icon = ( tasks[i].starred ) ? "images/star.png" : "images/task.png";

				if( sectionsList.indexOf( listsList[ tasks[i].list_id ] ) == -1 )
				{
					sectionsList.push( listsList[ tasks[i].list_id ] );
					taskSections.sections.push( { title: listsList[ tasks[i].list_id ], items:[] } );
					taskSections.sections[ sectionsList.indexOf( listsList[ tasks[i].list_id ] ) ].items.push({
						title:    tasks[i].title,
						subtitle: "Today",
						icon:     icon,
						data:     tasks[i]
					});
				}
				else
				{
					taskSections.sections[ sectionsList.indexOf( listsList[ tasks[i].list_id ] ) ].items.push({
						title: tasks[i].title,
						subtitle: "Today",
						icon: icon,
						data: tasks[i]
					});
				}
			}
		}
	}
	
	return taskSections;
}

function displayWeekTasks( tasks )
{
	if(DEBUG) console.log( "Displaying Week Tasks" );

	var week = new Date();
	week.setDate( week.getDate() + 6 );

	var i = today.getDay();
	// var in2Days = in3Days = in4Days = in5Days = in6Days = today;

	var in2Days = new Date( ( new Date() ).setDate( today.getDate() + 2 ) );
	var in3Days = new Date( ( new Date() ).setDate( today.getDate() + 3 ) );
	var in4Days = new Date( ( new Date() ).setDate( today.getDate() + 4 ) );
	var in5Days = new Date( ( new Date() ).setDate( today.getDate() + 5 ) );
	var in6Days = new Date( ( new Date() ).setDate( today.getDate() + 6 ) );

	// in3Days.setDate( in3Days.getDate() + 3 );
	// in4Days.setDate( in4Days.getDate() + 4 );
	// in5Days.setDate( in5Days.getDate() + 5 );
	// in6Days.setDate( in6Days.getDate() + 6 );

	var taskSections = {
		sections: [
			{ title: "Today, " + months[ today.getMonth() ] + ". " + today.getDate(), items:[] },
			{ title: "Tomorrow, " + months[ tomorrow.getMonth() ] + ". " + tomorrow.getDate(), items:[] },
			{ title: days[ in2Days.getDay() ] + ", " + months[ in2Days.getMonth() ] + ". " + in2Days.getDate(), items:[] },
			{ title: days[ in3Days.getDay() ] + ", " + months[ in3Days.getMonth() ] + ". " + in3Days.getDate(), items:[] },
			{ title: days[ in4Days.getDay() ] + ", " + months[ in4Days.getMonth() ] + ". " + in4Days.getDate(), items:[] },
			{ title: days[ in5Days.getDay() ] + ", " + months[ in5Days.getMonth() ] + ". " + in5Days.getDate(), items:[] },
			{ title: days[ in6Days.getDay() ] + ", " + months[ in6Days.getMonth() ] + ". " + in6Days.getDate(), items:[] },
		]
	};
			
	for ( i = 0; i < tasks.length; i++ )
	{
		if( tasks[i].due_date && tasks[i].title )
		{
			var date = new Date( tasks[i].due_date + "T00:00" + timeZone );

			if( date.getTime() < week.getTime() )
			{
				taskItems++;

				var icon = ( tasks[i].starred ) ? "images/star.png" : "images/task.png";

				var index = ( date.getTime() < today.getTime() ) ? 0 : ( date.getDay() - today.getDay() + ( ( ( date.getDay() - today.getDay() ) < 0 ) ? 7 : 0 ) );

				if(DEBUG) console.log( tasks[i].title + " - " + index );

				taskSections.sections[ index ].items.push({
					title:    tasks[i].title,
					subtitle: listsList[ tasks[i].list_id ],
					icon:     icon,
					data:     tasks[i]
				});
			}
		}
	}

	// loop through removing empty sections
	for ( i = 0; i < taskSections.sections.length; i++ )
	{
		if( !taskSections.sections[i].items.length )
		{
			taskSections.sections.splice( i, 1 );
			i--;
		}
	}

	return taskSections;	
}

function displayListTasks( tasks, list )
{
	if(DEBUG) console.log( "Displaying List Tasks" );

	var taskSections = { sections: [ { title: list, items:[] } ] };
	var menu = [];

	for ( var i = 0; i < tasks.length; i++ )
	{
		taskItems++;

		var dateString = tasks[i].due_date + "T00:00" + timeZone;
		var date = new Date( dateString );

		if( !tasks[i].due_date )
			date = "";
		else if( date.toDateString() == today.toDateString() )
			date = "Today";
		else if( date.toDateString() == tomorrow.toDateString() )
			date = "Tomorrow";
		else if( date.toDateString() == yesterday.toDateString() )
			date = "Yesterday";
		else
		{
			date = date.toISOString().slice( 0, 10 ).split( "-" );
			date = date[1] + "." + date[2] + "." + date[0];
		}

		var icon = ( tasks[i].starred ) ? "images/star.png" : "images/task.png";

		menu.push({
			title:    tasks[i].title,
			subtitle: date,
			icon:     icon,
			data:     tasks[i],
			position: taskPositions.indexOf( tasks[i].id )
		});
	}

	menu.sort( sortItems );
	
	taskSections.sections[0].items = menu;
		
	return taskSections;
}

function getTask( data )
{
	if(DEBUG) console.log( "Getting Task" );
	
	ajax(
	{
		url:     api + "/notes?task_id=" + data.id,
		type:    "json",
		method:  "get",
		headers: header
	},
	function( note )
	{
		try
		{
			if(DEBUG) console.log( JSON.stringify( note ) );

			// Reinitiate to clear window old content
			task = new UI.Window( { backgroundColor: "white" } );
						
			timeZone = new Date().toTimeString().slice( 12, 17 );
			timeZone = String( timeZone ).slice( 0, 3 ) + ":" + String( timeZone ).slice( 3 );
			
			var dateString = data.due_date + "T00:00" + timeZone;
			var displayDate = new Date( dateString );
			
			today = new Date();

			tomorrow = new Date();
			tomorrow.setDate( tomorrow.getDate() + 1 );
			
			yesterday = new Date();
			yesterday.setDate( yesterday.getDate() - 1 );
			
			if( !data.due_date )
				displayDate = "";
			else if( displayDate.toDateString() == today.toDateString() )
				displayDate = "Due Today";
			else if( displayDate.toDateString() == tomorrow.toDateString() )
				displayDate = "Due Tomorrow";
			else if(displayDate.toDateString() == yesterday.toDateString())
				displayDate = "Due Yesterday";
			else
			{
				displayDate = displayDate.toDateString().split(" ");
				displayDate = "Due on " + displayDate[1] + " " + Number( displayDate[2] ) + ", " + displayDate[3];
			}	
			
			var bg = new UI.Image(
			{
				position: new Vector2( 0, 0 ),
				image:    "images/task-bg.png"
			});
			
			var icon = ( data.starred ) ? taskStar : taskCheckbox;
			
			var title = new UI.Text(
			{
				position:      new Vector2( 24, 0 ),
				size:          new Vector2( 100, 30 ),
				font:          "gothic-14-bold",
				text:          data.title,
				textOverflow:  "ellipsis",
				color:         "black",
				textAlign:     "left"
			});

			var date = new UI.Text(
			{
				position:  new Vector2( 24, 30 ),
				size:      new Vector2( 115, 30 ),
				font:      "gothic-14",
				text:      displayDate,
				color:     "black",
				textAlign: "left"
			});
			
			var note = new UI.Text(
			{
				position:     new Vector2( 5, 46 ),
				size:         new Vector2( 114, 100 ),
				font:         "gothic-14",
				text:         ( note.length ) ? note[0].content : "",
				textOverflow: "ellipsis",
				color:        "black",
				textAlign:    "left"
			});
			
			task.add( bg );
			task.add( icon );
			task.add( title );
			task.add( date );
			task.add( note );
			
			task.id = data.id;
			task.data = data;

			task.show();
		}
		catch( err )
		{
			reportError( "Getting Task Details: " + err.message );
		}
	},
	function( err )
	{
		if(DEBUG) console.log( "Getting Task Failed: " + JSON.stringify( err ) );
		reportError( "Getting Task Notes AJAX: " + JSON.stringify( err ) );
	});		
}

function completeTask( event )
{
	if(DEBUG) console.log( "Changing Complete Status" );

	var date = new Date().toISOString();
	date = date.slice( 0, date.indexOf( "T" ) );

	// Mark as done optimistically to improve UX.
	if( event.item.data.completed )
		taskMenu.item( event.sectionIndex, event.itemIndex, { title: event.item.title, subtitle: event.item.subtitle, icon: "images/task.png", data: event.item.data, position: event.item.position } );
	else
		taskMenu.item( event.sectionIndex, event.itemIndex, { title: event.item.title, subtitle: event.item.subtitle, icon: "images/done.png", data: event.item.data, position: event.item.position } );

	ajax(
	{
		url:     api + "/tasks/" + event.item.data.id,
		type:    "json",
		method:  "get",
		headers: header
	},
	function( taskData )
	{
		ajax(
		{
			url:     api + "/tasks/" + event.item.data.id,
			type:    "json",
			method:  "patch",
			headers: header,
			data:    { revision: taskData.revision, completed: !taskData.completed }
		},
		function( data )
		{
			if(DEBUG) console.log( JSON.stringify( data ) );
			
			if( data.completed )
			{
				if(DEBUG) console.log( "Task Marked Complete" );
				taskMenu.item( event.sectionIndex, event.itemIndex, { title: event.item.title, subtitle: event.item.subtitle, icon: "images/done.png", data: data, position: event.item.position } );
			}
			else
			{
				if(DEBUG) console.log( "Task Marked Incomplete" );
				taskMenu.item( event.sectionIndex, event.itemIndex, { title: event.item.title, subtitle: event.item.subtitle, icon: "images/task.png", data: data, position: event.item.position } );
			}
		},
		function( err )
		{
			if(DEBUG) console.log( "Completing Task Failed: " + JSON.stringify( err ) );
			reportError( "Marking Task Complete AJAX: " + JSON.stringify( err ) );
		});
	},
	function( err )
	{
		if(DEBUG) console.log( "Completing Task Failed: " + JSON.stringify( err ) );
		reportError( "Marking Task Complete AJAX: " + JSON.stringify( err ) );
	});
}

function getListPositions( callback )
{
	if(DEBUG) console.log( "Getting List Positions" );
	
	ajax(
	{
		url:     api + "/list_positions",
		type:    "json",
		method:  "get",
		headers: header
	},
	function( data )
	{
		try
		{
			if( DEBUG ) console.log( JSON.stringify( data[0].values ) );
			
			listPositions = data[0].values;
			
			if(DEBUG) console.log( "Got List Positions" );
			
			if( typeof callback !== "undefined" ) callback();
		}
		catch( err )
		{
			reportError( "Getting List Positions: " + err.message );
		}
	},
	function( err )
	{
		if(DEBUG) console.log( "Getting List Positions Failed: " + JSON.stringify( err ) );
		reportError( "Getting List Positions AJAX: " + JSON.stringify( err ) );
	});
}

function getTaskPositions( id, callback )
{
	if(DEBUG) console.log( "Getting Task Positions" );

	if( isNaN(id) )
	{
		if(DEBUG) console.log( "Skipped Task Positions" );

		if( typeof callback !== "undefined" ) callback();
		
		return false;
	}
	
	ajax(
	{
		url:     api + "/task_positions?list_id=" + id,
		type:    "json",
		method:  "get",
		headers: header
	},
	function( data )
	{
		try
		{
			if(DEBUG) console.log( JSON.stringify( data[0].values ) );
			
			taskPositions = data[0].values;
			
			if(DEBUG) console.log( "Got Task Positions" );
			
			if( typeof callback !== "undefined" ) callback();
		}
		catch( err )
		{
			reportError( "Getting Task Positions: " + err.message );
		}
	},
	function( err )
	{
		if(DEBUG) console.log( "Getting Task Positions Failed: " + JSON.stringify( err ) );
		reportError( "Getting Task Positions AJAX: " + JSON.stringify( err ) );
	});
}

function getShares( callback )
{
	if(DEBUG) console.log( "Getting Shares" );
	
	shares = [];
	
	var semaphore = 0;
	
	for ( var i = 0; i < listPositions.length; i++ )
	{
		semaphore++;
		if(DEBUG) console.log( "Running Task: "+ semaphore );
		
		ajax(
		{
			url:     api + "/memberships?list_id=" + listPositions[i],
			type:    "json",
			method:  "get",
			headers: header
		},
		function( data )
		{
			try
			{
				if( data.length > 1 ) shares.push( data[0].list_id );
			}
			catch( err )
			{
				reportError( "Getting Shares: " + err.message );
			}
			finally
			{
				semaphore--;
				if(DEBUG) console.log( "Ending Task, " + semaphore + " Left" );
				if( semaphore === 0 )
				{
					if(DEBUG) console.log( JSON.stringify( shares ) );
					if(DEBUG) console.log( "Got Shares" );

					if( typeof callback !== "undefined" ) callback();
				}
			}
		},
		function( err )
		{
			if(DEBUG) console.log( "Getting Shares Failed: " + JSON.stringify( err ) );
			if( err.type != "permission_error" )
			{
				reportError( "Getting Shares AJAX: " + JSON.stringify( err ) );
			}
			
			semaphore--;
			if(DEBUG) console.log( "Ending Task, " + semaphore + " Left" );
			if( semaphore === 0 )
			{
				if(DEBUG) console.log( JSON.stringify( shares ) );
				if(DEBUG) console.log( "Got Shares" );
				
				if( typeof callback !== "undefined" ) callback();
			}
		});
	}	
}

function getUserData()
{
	ajax(
	{
		url:     api + "/user",
		type:    "json",
		method:  "get",
		headers: header,
		cache:   false
	},
	function( userData )
	{
		Settings.data( "user", userData );
	},
	function( error )
	{
		if(DEBUG) console.log( "Getting User Data Failed: " + JSON.stringify( error ) );		
		reportError( "Getting User Data: " + JSON.stringify( error ) );
	});
}


// UTILITY FUNCTIONS
function sortItems( a, b )
{
	if( a.position < b.position )
		return -1;
	if( a.position > b.position )
		return 1;
	// a must be equal to b
		return 0;
}

function reportError( err )
{
	if(DEBUG) console.log( "Reporting Error" );	
	var today = new Date();

	if( Settings.option( "reporting" ) )
	{
		ajax(
		{
			url:    reporting,
			type:   "string",
			method: "post",
			data:   { timestamp: today.toISOString(), error: err, identifier: Settings.data( "user" ).email, version: VERSION }
		},
		function( data )
		{
			if(DEBUG) console.log( "Error Reported: " + err );
			if(DEBUG) console.log( data );
		},
		function( err )
		{
      if(DEBUG) console.log( "Error Report Failed: " + JSON.stringify( err ) );
		});
	}
	else
		return false;
}