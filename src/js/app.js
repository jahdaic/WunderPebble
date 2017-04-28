/**
 * WunderPebble
 * By: Jahdai Cintron
 * http://wunderpebble.com
 */
// DEBUGGING
var DEBUG = false;
var VERSION = 2.11;

// INCLUDES
var UI = require( "ui" );
var ajax = require( "ajax" );
var Settings = require( "settings" );
var Vector2 = require( "vector2" );
var Feature = require( 'platform/feature' );
var Platform = require( 'platform' );

// GLOBAL VARIABLES
var api = "https://a.wunderlist.com/api/v1";
var clientID = "5e2f2e075f8aa1a5f94d";
var header = {
	"X-Access-Token": Settings.option( "token" ),
	"X-Client-ID": clientID,
	contentType: "application/json"
};
var reporting = "https://wunderpebble.com/config/report.php";
var taskItems = 0;
var shares = [];
var folders = {};
var listPositions = [];
var taskPositions = [];
var folderLists = {};
var listsList = {
	inbox: "Inbox",
	today: "Today",
	week: "Week"
};
var days = [ "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday" ];
var months = [ "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December" ];
// var monthsShort   = [ "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" ];
var today;
var tomorrow;
var yesterday;
var timeZone;

// CONFIGURATION
Settings.config(
	{
		url: "https://wunderpebble.com/config/?data=" + getURIOptions(),
		autoSave: true,
		hash: false
	},
	function ( e )
	{
		if ( DEBUG ) console.log( "Open Configuration" );
	},
	function ( e )
	{
		if ( DEBUG ) console.log( "Closed Configuration" );

		var data;

		try
		{
			data = JSON.parse( e.response );
		}
		catch ( error )
		{
			data = e.response;
		}
		finally
		{
			// For testing in CloudPebble we manually set token
			// Settings.option( "token", "" );
		}

		if ( DEBUG ) console.log( e.response );

		Settings.option( "version", VERSION );

		header = {
			"X-Access-Token": Settings.option( "token" ),
			"X-Client-ID": clientID,
			contentType: "application/json;"
		};

		getUserData();
	}
);

// WINDOWS
var error = new UI.Card(
{	title: " Error",
	body: "",
	icon: "images/error.png",
	style: "small",
	scrollable: true
} );

var listMenu = new UI.Menu(
{
	sections: [
	{
		items: []
	} ],
	status:
	{
		color: getTextColor(),
		backgroundColor: getBGColor(),
	},
	textColor: getTextColor(),
	backgroundColor: getBGColor(),
	highlightTextColor: getHighlightTextColor(),
	highlightBackgroundColor: getHighlightBGColor()
} );

var sublistMenu = new UI.Menu(
{
	sections: [
	{
		items: []
	} ],
	status:
	{
		color: getTextColor(),
		backgroundColor: getBGColor(),
	},
	textColor: getTextColor(),
	backgroundColor: getBGColor(),
	highlightTextColor: getHighlightTextColor(),
	highlightBackgroundColor: getHighlightBGColor()
} );

var taskMenu;
var task;

// EVENT LISTENERS
listMenu.on( "select", clickOnList );

sublistMenu.on( "select", clickOnList );

// PROGRAM START
function programStart()
{
	if ( typeof Settings.option( "token" ) !== "undefined" && Settings.option( "token" ) !== null && typeof Settings.option( "version" ) !== "undefined" && Settings.option( "version" ) !== null )
	{
		var splash = new UI.Card(
		{
			banner: ( Feature.round() ) ? "images/splash-round.png" : "images/splash.png"
		} );

		splash.show();

		if ( Settings.data( "user" ) === null )
			getUserData();

		try
		{
			getListPositions( function ()
			{
				getShares( function ()
				{
					getLists( null, function ()
					{
						listMenu.show();
						splash.hide();
					} );
				} );
			} );
		}
		catch ( err )
		{
			reportError( "Program Start: " + err.message );
		}
	}
	else
	{
		var noConfig = new UI.Card(
		{
			title: " WunderPebble",
			body: "\nOpen the Pebble App on your phone to configure, then restart.",
			icon: "images/icon.png",
			style: "small"
		} );

		noConfig.show();
	}
}

programStart();

// DATA ACCESS FUNCTIONS
function getLists( folder, callback )
{
	if ( DEBUG ) console.log( "Getting Folders" );

	ajax(
		{
			url: api + "/folders",
			type: "json",
			method: "get",
			headers: header,
			cache: false
		},
		function ( data )
		{
			folderLists = {};

			for ( var i = 0; i < data.length; i++ )
			{
				folders[ data[ i ].id ] = data[ i ];

				for ( var j = 0; j < data[ i ].list_ids.length; j++ )
				{
					folderLists[ data[ i ].list_ids[ j ] ] = data[ i ].id;
				}
			}

			if ( DEBUG ) console.log( "Folders: " + JSON.stringify( folders ) );
			if ( DEBUG ) console.log( "Folder List: " + JSON.stringify( folderLists ) );
			if ( DEBUG ) console.log( "Getting Lists" );

			ajax(
				{
					url: api + "/lists",
					type: "json",
					method: "get",
					headers: header,
					cache: false
				},
				function ( data )
				{
					if ( DEBUG ) console.log( "Lists: " + JSON.stringify( data ) );
					if ( DEBUG ) console.log( "Got Lists" );

					var lists = data;

					if ( folder === null )
					{
						displayLists( lists, false );
					}
					else
					{
						for ( var i = 0; i < lists.length; i++ )
						{
							if ( folders[ folder ].list_ids.indexOf( lists[ i ].id ) == -1 )
							{
								lists.splice( i, 1 );
								i--;
							}
						}

						if ( DEBUG ) console.log( "Lists for Folder: " + JSON.stringify( lists ) );

						displayLists( lists, cleanTitle( folders[ folder ].title ) );
					}

					if ( typeof callback !== "undefined" ) callback();
				},
				function ( error )
				{
					if ( DEBUG ) console.log( "Getting Lists Failed: " + JSON.stringify( error ) );
					reportError( "Getting Lists: " + JSON.stringify( error ) );
				} );
		},
		function ( error )
		{
			if ( DEBUG ) console.log( "Getting Folders Failed: " + JSON.stringify( error ) );
			reportError( "Getting Folders: " + JSON.stringify( error ) );
		} );
}

function displayLists( lists, sublist )
{
	if ( DEBUG ) console.log( "Displaying Lists" );

	try
	{
		var menu = [];

		if ( !sublist )
		{
			menu = [
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
			} ];
		}

		var foldersAdded = [];

		for ( var i = 0; i < lists.length; i++ )
		{
			if ( lists[ i ].title == "inbox" )
			{
				menu[ 0 ].id = lists[ i ].id;
				listsList[ lists[ i ].id ] = "Inbox";
			}
			else if ( lists[ i ].id in folderLists && !sublist )
			{

				if ( foldersAdded.indexOf( folders[ folderLists[ lists[ i ].id ] ].id ) != -1 )
					continue;

				menu.push(
				{
					title: cleanTitle( folders[ folderLists[ lists[ i ].id ] ].title ),
					icon: "images/folder.png",
					id: folders[ folderLists[ lists[ i ].id ] ].id,
					position: ( listPositions.indexOf( lists[ i ].id ) >= 0 ) ? listPositions.indexOf( lists[ i ].id ) : lists.length + lists[ i ].id,
					type: "folder"
				} );

				foldersAdded.push( folders[ folderLists[ lists[ i ].id ] ].id );
			}
			else
			{
				menu.push(
				{
					title: cleanTitle( lists[ i ].title ),
					icon: ( shares.indexOf( lists[ i ].id ) > -1 ) ? "images/group.png" : "images/list.png",
					id: lists[ i ].id,
					position: ( listPositions.indexOf( lists[ i ].id ) >= 0 ) ? listPositions.indexOf( lists[ i ].id ) : lists.length + lists[ i ].id,
					type: "list"
				} );

				listsList[ lists[ i ].id ] = lists[ i ].title;
			}
		}

		menu.sort( sortItems );

		if ( sublist )
			sublistMenu.section( 0,
			{
				title: cleanTitle( sublist ),
				items: menu
			} );
		else
			listMenu.items( 0, menu );

		if ( DEBUG ) console.log( "Displayed Lists" );
	}
	catch ( err )
	{
		reportError( "Displaying Lists: " + err.message );
	}
}

function getTasks( id, list, callback )
{
	if ( DEBUG ) console.log( "Gettings Tasks" );

	// We have a list ID so we can get tasks for it
	if ( !isNaN( id ) )
	{
		ajax(
			{
				url: api + "/tasks?list_id=" + id + "&completed=false",
				type: "json",
				method: "get",
				headers: header,
				cache: false
			},
			function ( data )
			{
				try
				{
					displayTasks( id, list, data );

					if ( typeof callback !== "undefined" ) callback();
				}
				catch ( err )
				{
					reportError( "Getting Tasks: " + err.message );
				}
			},
			function ( err )
			{
				if ( DEBUG ) console.log( "Getting Tasks Failed: " + JSON.stringify( err ) );
				reportError( "Getting Tasks: " + JSON.stringify( err ) );
			}
		);
	}
	// No list ID so we get all the tasks in the listPositions?
	else
	{
		var tasks = [];

		var semaphore = 0;

		for ( var i = 0; i < listPositions.length; i++ )
		{
			semaphore++;
			if ( DEBUG ) console.log( "Running Task: " + semaphore );

			ajax(
				{
					url: api + "/tasks?list_id=" + listPositions[ i ] + "&completed=false",
					type: "json",
					method: "get",
					headers: header,
					cache: false
				},
				function ( data )
				{
					try
					{
						if ( data.length > 0 ) tasks = tasks.concat( data );
					}
					catch ( err )
					{
						reportError( "Getting Shares: " + err.message );
					}
					finally
					{
						semaphore--;
						if ( DEBUG ) console.log( "Ending Task, " + semaphore + " Left" );

						if ( semaphore === 0 )
						{
							displayTasks( id, list, tasks );
							if ( typeof callback !== "undefined" ) callback();
						}
					}
				},
				function ( err )
				{
					if ( DEBUG ) console.log( "Getting All Tasks Failed: " + JSON.stringify( err ) );

					if ( err.type != "permission_error" )
					{
						reportError( "Getting All Tasks: " + JSON.stringify( err ) );
					}

					semaphore--;
					if ( DEBUG ) console.log( "Ending Task, " + semaphore + " Left" );

					if ( semaphore === 0 )
					{
						displayTasks( id, list, tasks );
						if ( typeof callback !== "undefined" ) callback();
					}
				}
			);
		}
	}
}

function displayTasks( id, list, tasks )
{
	if ( DEBUG ) console.log( "Tasks: " + JSON.stringify( tasks ) );
	if ( DEBUG ) console.log( "Got " + tasks.length + " Tasks" );
	if ( DEBUG ) console.log( "Displaying Tasks" );

	today = new Date();

	tomorrow = new Date();
	tomorrow.setDate( tomorrow.getDate() + 1 );

	yesterday = new Date();
	yesterday.setDate( yesterday.getDate() - 1 );

	timeZone = new Date().toTimeString().slice( 12, 17 );
	timeZone = String( timeZone ).slice( 0, 3 ) + ":" + String( timeZone ).slice( 3 );

	var menuItems;

	if ( id == "today" )
		menuItems = displayTodayTasks( tasks );
	else if ( id == "week" )
		menuItems = displayWeekTasks( tasks );
	else
		menuItems = displayListTasks( tasks, list );

	taskMenu = new UI.Menu(
	{
		sections: menuItems.sections,
		status:
		{
			color: getTextColor(),
			backgroundColor: getBGColor(),
		},
		textColor: getTextColor(),
		backgroundColor: getBGColor(),
		highlightTextColor: getHighlightTextColor(),
		highlightBackgroundColor: getHighlightBGColor()
	} );

	taskMenu.on( "select", clickOnTask );
	taskMenu.on( "longSelect", longClickOnTask );

	new UI.Menu( menuItems );
	taskMenu.id = id;
	taskMenu.list = list;

	if ( DEBUG ) console.log( "Displaying Task List Object" );
	if ( DEBUG ) console.log( JSON.stringify( taskMenu ) );
	if ( DEBUG ) console.log( "Displayed " + taskItems + " Tasks" );
}

function displayTodayTasks( tasks )
{
	if ( DEBUG ) console.log( "Displaying Today Tasks" );

	var taskSections = {
		sections: []
	};
	var sectionsList = [];

	for ( var i = 0; i < tasks.length; i++ )
	{
		if ( tasks[ i ].due_date && tasks[ i ].title )
		{
			var date = new Date( tasks[ i ].due_date + "T00:00" + timeZone );

			if ( date.getTime() <= today.getTime() )
			{
				taskItems++;

				var icon = ( tasks[ i ].starred ) ? "images/star.png" : "images/task.png";

				if ( sectionsList.indexOf( listsList[ tasks[ i ].list_id ] ) == -1 )
				{
					sectionsList.push( listsList[ tasks[ i ].list_id ] );
					taskSections.sections.push(
					{
						title: cleanTitle( listsList[ tasks[ i ].list_id ] ),
						items: []
					} );
					taskSections.sections[ sectionsList.indexOf( listsList[ tasks[ i ].list_id ] ) ].items.push(
					{
						title: cleanTitle( tasks[ i ].title ),
						subtitle: "Today",
						icon: icon,
						data: tasks[ i ]
					} );
				}
				else
				{
					taskSections.sections[ sectionsList.indexOf( listsList[ tasks[ i ].list_id ] ) ].items.push(
					{
						title: cleanTitle( tasks[ i ].title ),
						subtitle: "Today",
						icon: icon,
						data: tasks[ i ]
					} );
				}
			}
		}
	}

	return taskSections;
}

function displayWeekTasks( tasks )
{
	if ( DEBUG ) console.log( "Displaying Week Tasks" );

	var week = new Date();
	week.setDate( week.getDate() + 6 );

	var i = today.getDay();

	var in2Days = new Date( ( new Date() ).setDate( today.getDate() + 2 ) );
	var in3Days = new Date( ( new Date() ).setDate( today.getDate() + 3 ) );
	var in4Days = new Date( ( new Date() ).setDate( today.getDate() + 4 ) );
	var in5Days = new Date( ( new Date() ).setDate( today.getDate() + 5 ) );
	var in6Days = new Date( ( new Date() ).setDate( today.getDate() + 6 ) );

	var taskSections = {
		sections: [
		{
			title: "Today, " + months[ today.getMonth() ] + ". " + today.getDate(),
			items: []
		},
		{
			title: "Tomorrow, " + months[ tomorrow.getMonth() ] + ". " + tomorrow.getDate(),
			items: []
		},
		{
			title: days[ in2Days.getDay() ] + ", " + months[ in2Days.getMonth() ] + ". " + in2Days.getDate(),
			items: []
		},
		{
			title: days[ in3Days.getDay() ] + ", " + months[ in3Days.getMonth() ] + ". " + in3Days.getDate(),
			items: []
		},
		{
			title: days[ in4Days.getDay() ] + ", " + months[ in4Days.getMonth() ] + ". " + in4Days.getDate(),
			items: []
		},
		{
			title: days[ in5Days.getDay() ] + ", " + months[ in5Days.getMonth() ] + ". " + in5Days.getDate(),
			items: []
		},
		{
			title: days[ in6Days.getDay() ] + ", " + months[ in6Days.getMonth() ] + ". " + in6Days.getDate(),
			items: []
		}, ]
	};

	for ( i = 0; i < tasks.length; i++ )
	{
		if ( tasks[ i ].due_date && tasks[ i ].title )
		{
			var date = new Date( tasks[ i ].due_date + "T00:00" + timeZone );

			if ( date.getTime() < week.getTime() )
			{
				taskItems++;

				var icon = ( tasks[ i ].starred ) ? "images/star.png" : "images/task.png";

				var index = ( date.getTime() < today.getTime() ) ? 0 : ( date.getDay() - today.getDay() + ( ( ( date.getDay() - today.getDay() ) < 0 ) ? 7 : 0 ) );

				if ( DEBUG ) console.log( tasks[ i ].title + " - " + index );

				taskSections.sections[ index ].items.push(
				{
					title: cleanTitle( tasks[ i ].title ),
					subtitle: cleanTitle( listsList[ tasks[ i ].list_id ] ),
					icon: icon,
					data: tasks[ i ]
				} );
			}
		}
	}

	// loop through removing empty sections
	for ( i = 0; i < taskSections.sections.length; i++ )
	{
		if ( !taskSections.sections[ i ].items.length )
		{
			taskSections.sections.splice( i, 1 );
			i--;
		}
	}

	return taskSections;
}

function displayListTasks( tasks, list )
{
	if ( DEBUG ) console.log( "Displaying List Tasks" );

	var taskSections = {
		sections: [
		{
			title: cleanTitle( list ),
			items: []
		} ]
	};
	var menu = [];

	for ( var i = 0; i < tasks.length; i++ )
	{
		taskItems++;

		var dateString = tasks[ i ].due_date + "T00:00" + timeZone;
		var date = new Date( dateString );
		var color;

		if ( !tasks[ i ].due_date )
		{
			date = "";
		}
		else if ( date.toDateString() == today.toDateString() )
		{
			date = "Today";
			color = "blue";
		}
		else if ( date.toDateString() == tomorrow.toDateString() )
		{
			date = "Tomorrow";
			color = "blue";
		}
		else if ( date.toDateString() == yesterday.toDateString() )
		{
			date = "Yesterday";
			color = "red";
		}
		else
		{
			date = date.toISOString().slice( 0, 10 ).split( "-" );
			date = date[ 1 ] + "/" + date[ 2 ] + "/" + date[ 0 ];
			color = "blue";
		}

		var icon = ( tasks[ i ].starred ) ? "images/star.png" : "images/task.png";

		menu.push(
		{
			title: cleanTitle( tasks[ i ].title ),
			subtitle: date,
			icon: icon,
			data: tasks[ i ],
			position: ( taskPositions.indexOf( tasks[ i ].id ) >= 0 ) ? taskPositions.indexOf( tasks[ i ].id ) : tasks.length + tasks[ i ].id
		} );
	}

	menu.sort( sortItems );

	taskSections.sections[ 0 ].items = menu;

	return taskSections;
}

function getTask( data )
{
	if ( DEBUG ) console.log( "Getting Task " + data.id );

	ajax(
		{
			url: api + "/notes?task_id=" + data.id,
			type: "json",
			method: "get",
			headers: header
		},
		function ( note )
		{
			try
			{
				if ( DEBUG ) console.log( JSON.stringify( note ) );

				note = ( note.length > 0 ) ? note[ 0 ].content : '';

				// Reinitiate to clear window old content
				task = new UI.Window(
				{
					backgroundColor: getBGColor()
				} );

				timeZone = new Date().toTimeString().slice( 12, 17 );
				timeZone = String( timeZone ).slice( 0, 3 ) + ":" + String( timeZone ).slice( 3 );

				var dateString = data.due_date + "T00:00" + timeZone;
				var displayDate = new Date( dateString );
				var color = getTextColor();

				today = new Date();

				tomorrow = new Date();
				tomorrow.setDate( tomorrow.getDate() + 1 );

				yesterday = new Date();
				yesterday.setDate( yesterday.getDate() - 1 );

				if ( !data.due_date )
				{
					displayDate = "";
				}
				else if ( displayDate.toDateString() == today.toDateString() )
				{
					displayDate = "Due Today";
					color = "blue";
				}
				else if ( displayDate.toDateString() == tomorrow.toDateString() )
				{
					displayDate = "Due Tomorrow";
					color = "blue";
				}
				else if ( displayDate.toDateString() == yesterday.toDateString() )
				{
					displayDate = "Due Yesterday";
					color = "red";
				}
				else
				{
					if ( displayDate.getTime() < today.getTime() )
						color = "red";
					else
						color = "blue";

					displayDate = displayDate.toDateString().split( " " );
					displayDate = "Due on " + displayDate[ 1 ] + " " + Number( displayDate[ 2 ] ) + ", " + displayDate[ 3 ];
				}

				var lineNum = Math.floor( ( Feature.resolution().y - Feature.rectangle( 47, 53 ) ) / 14 );

				// Creating lines for notes field
				for ( var i = lineNum; i > 0; i-- )
				{
					var y = i * 14 + Feature.rectangle( 47, 53 );

					var line = new UI.Rect(
					{
						position: new Vector2( 5, y ),
						size: new Vector2( Feature.resolution().x - 10, 1 ),
						backgroundColor: (Settings.option("theme") == "light") ? "light-gray" : "dark-gray",
						borderWidth: 0
					} );

					task.add( line );
				}

				// Since we don't know the exact width at all parts of a round screen, we add borders
				// to clean up the full width lines
				if ( Feature.round() )
				{
					var cleanLines = new UI.Circle(
					{
						position: new Vector2( Feature.resolution().x / 2 - 1, Feature.resolution().y / 2 - 1 ),
						radius: Feature.resolution().x / 2,
						backgroundColor: 'clear',
						borderColor: getBGColor(),
						borderWidth: 6
					} );

					task.add( cleanLines );
				}

				var topDivider = new UI.Line(
				{
					position: Feature.rectangle( new Vector2( 1, 31 ), new Vector2( 1, 37 ) ),
					position2: Feature.rectangle( new Vector2( Feature.resolution().x - 2, 31 ), new Vector2( Feature.resolution().x - 2, 37 ) ),
					strokeColor: getTextColor(),
					strokeWidth: 1
				} );

				task.add( topDivider );

				var bottomDivider = new UI.Line(
				{
					position: Feature.rectangle( new Vector2( 1, 47 ), new Vector2( 1, 53 ) ),
					position2: Feature.rectangle( new Vector2( Feature.resolution().x - 2, 47 ), new Vector2( Feature.resolution().x - 2, 53 ) ),
					strokeColor: getTextColor(),
					strokeWidth: 1
				} );

				task.add( bottomDivider );

				// Onlt show outline in rectangular screens
				if ( Feature.rectangle() )
				{
					var outline = ( Feature.rectangle() ) ?
						new UI.Rect(
						{
							position: new Vector2( 1, 1 ),
							size: new Vector2( Feature.resolution().x - 2, Feature.resolution().y - 2 ),
							backgroundColor: 'clear',
							borderColor: getTextColor(),
							borderWidth: 1
						} ) :
						new UI.Circle(
						{
							position: new Vector2( Feature.resolution().x / 2 - 1, Feature.resolution().y / 2 - 1 ),
							radius: Feature.resolution().x / 2 - 1,
							backgroundColor: 'clear',
							borderColor: getTextColor(),
							borderWidth: 1
						} );

					task.add( outline );
				}

				var icon = ( data.starred ) ?
					new UI.Image(
					{
						position: new Vector2( 6, 2 ),
						size: new Vector2( 14, 26 ),
						image: "images/task-star.png"
					} ) :
					new UI.Image(
					{
						position: new Vector2( 7, 11 ),
						size: new Vector2( 12, 12 ),
						image: "images/task-checkbox.png",
						compositing: ( Settings.option( "theme" ) == 'dark' ) ? 'invert' : 'normal'
					} );

				task.add( icon );

				var title = new UI.Text(
				{
					position: ( Feature.round() ) ? new Vector2( 5, 6 ) : new Vector2( 24, 0 ),
					size: ( Feature.round() ) ? new Vector2( 170, 30 ) : new Vector2( 100, 30 ),
					font: "gothic-14-bold",
					text: ( Feature.round() ) ? flowForRound( data.title, [ 13, 20 ] ) : cleanTitle( data.title ),
					textOverflow: "ellipsis",
					color: getTextColor(),
					textAlign: Feature.round( 'center', 'left' )
				} );

				task.add( title );

				var date = new UI.Text(
				{
					position: Feature.round( new Vector2( 0, 36 ), new Vector2( 24, 30 ) ),
					size: Feature.round( new Vector2( 180, 30 ), new Vector2( 115, 30 ) ),
					font: "gothic-14",
					text: displayDate,
					color: color,
					textAlign: Feature.round( 'center', 'left' )
				} );

				task.add( date );

				note = new UI.Text(
				{
					position: Feature.round( new Vector2( 5, 52 ), new Vector2( 5, 46 ) ),
					size: Feature.round( new Vector2( 170, 115 ), new Vector2( 133, 115 ) ),
					font: "gothic-14",
					text: Feature.round( flowForRound( note, [ 28, 28, 28, 28, 26, 24, 21, 15 ] ), cleanTitle( note ) ),
					textOverflow: "ellipsis",
					color: getTextColor(),
					textAlign: Feature.round( 'center', 'left' )
				} );

				task.add( note );
				
				task.id = data.id;
				task.data = data;

				task.show();
			}
			catch ( err )
			{
				if ( DEBUG ) console.log( "Getting Task Details Failed: " + err.message );
				reportError( "Getting Task Details: " + err.message );
			}
		},
		function ( err )
		{
			if ( DEBUG ) console.log( "Getting Task Failed: " + JSON.stringify( err ) );
			reportError( "Getting Task Notes AJAX: " + JSON.stringify( err ) );
		} );
}

function completeTask( event )
{
	if ( DEBUG ) console.log( "Changing Complete Status" );

	var date = new Date().toISOString();
	date = date.slice( 0, date.indexOf( "T" ) );

	// Mark as done optimistically to improve UX.
	if ( event.item.data.completed )
		taskMenu.item( event.sectionIndex, event.itemIndex,
		{
			title: event.item.title,
			subtitle: event.item.subtitle,
			icon: "images/task.png",
			data: event.item.data,
			position: event.item.position
		} );
	else
		taskMenu.item( event.sectionIndex, event.itemIndex,
		{
			title: event.item.title,
			subtitle: event.item.subtitle,
			icon: "images/done.png",
			data: event.item.data,
			position: event.item.position
		} );

	ajax(
		{
			url: api + "/tasks/" + event.item.data.id,
			type: "json",
			method: "get",
			headers: header
		},
		function ( taskData )
		{
			ajax(
				{
					url: api + "/tasks/" + event.item.data.id,
					type: "json",
					method: "patch",
					headers: header,
					data:
					{
						revision: taskData.revision,
						completed: !taskData.completed
					}
				},
				function ( data )
				{
					if ( DEBUG ) console.log( JSON.stringify( data ) );

					if ( data.completed )
					{
						if ( DEBUG ) console.log( "Task Marked Complete" );
						taskMenu.item( event.sectionIndex, event.itemIndex,
						{
							title: event.item.title,
							subtitle: event.item.subtitle,
							icon: "images/done.png",
							data: data,
							position: event.item.position
						} );
					}
					else
					{
						if ( DEBUG ) console.log( "Task Marked Incomplete" );
						taskMenu.item( event.sectionIndex, event.itemIndex,
						{
							title: event.item.title,
							subtitle: event.item.subtitle,
							icon: "images/task.png",
							data: data,
							position: event.item.position
						} );
					}
				},
				function ( err )
				{
					if ( DEBUG ) console.log( "Completing Task Failed: " + JSON.stringify( err ) );
					reportError( "Marking Task Complete AJAX: " + JSON.stringify( err ) );
				} );
		},
		function ( err )
		{
			if ( DEBUG ) console.log( "Completing Task Failed: " + JSON.stringify( err ) );
			reportError( "Marking Task Complete AJAX: " + JSON.stringify( err ) );
		} );
}

function getListPositions( callback )
{
	if ( DEBUG ) console.log( "Getting List Positions" );

	ajax(
		{
			url: api + "/list_positions",
			type: "json",
			method: "get",
			headers: header
		},
		function ( data )
		{
			try
			{
				if ( DEBUG ) console.log( "List Positions: " + JSON.stringify( data[ 0 ].values ) );

				listPositions = data[ 0 ].values;

				if ( DEBUG ) console.log( "Got List Positions" );

				if ( typeof callback !== "undefined" ) callback();
			}
			catch ( err )
			{
				reportError( "Getting List Positions: " + err.message );
			}
		},
		function ( err )
		{
			if ( DEBUG ) console.log( "Getting List Positions Failed: " + JSON.stringify( err ) );
			reportError( "Getting List Positions AJAX: " + JSON.stringify( err ) );
		} );
}

function getTaskPositions( id, callback )
{
	if ( DEBUG ) console.log( "Getting Task Positions" );

	if ( isNaN( id ) )
	{
		if ( DEBUG ) console.log( "Skipped Task Positions" );

		if ( typeof callback !== "undefined" ) callback();

		return false;
	}

	ajax(
		{
			url: api + "/task_positions?list_id=" + id,
			type: "json",
			method: "get",
			headers: header
		},
		function ( data )
		{
			try
			{
				if ( DEBUG ) console.log( JSON.stringify( data[ 0 ].values ) );

				taskPositions = data[ 0 ].values;

				if ( DEBUG ) console.log( "Got Task Positions" );

				if ( typeof callback !== "undefined" ) callback();
			}
			catch ( err )
			{
				reportError( "Getting Task Positions: " + err.message );
			}
		},
		function ( err )
		{
			if ( DEBUG ) console.log( "Getting Task Positions Failed: " + JSON.stringify( err ) );
			reportError( "Getting Task Positions AJAX: " + JSON.stringify( err ) );
		} );
}

function getShares( callback )
{
	if ( DEBUG ) console.log( "Getting Shares" );

	shares = [];

	ajax(
		{
			url: api + "/memberships",
			type: "json",
			method: "get",
			headers: header
		},
		function ( data )
		{
			try
			{
				if ( data.length > 1 )
				{
					for ( var i = 0; i < data.length; i++ )
					{
						if ( data[ i ].state == "accepted" )
						{
							shares.push( data[ i ].list_id );
						}
					}
				}
			}
			catch ( err )
			{
				reportError( "Getting Shares: " + err.message );
			}
			finally
			{
				if ( DEBUG ) console.log( "Shares: " + JSON.stringify( shares ) );
				if ( DEBUG ) console.log( "Got Shares" );

				if ( typeof callback !== "undefined" ) callback();
			}
		},
		function ( err, status, req )
		{
			if ( DEBUG ) console.log( "Getting Shares Failed: " + JSON.stringify( err ) + "|" + JSON.stringify( status ) + "|" + JSON.stringify( req ) );
			if ( err.type != "permission_error" )
			{
				reportError( "Getting Shares AJAX: " + JSON.stringify( err ) );
			}

			if ( DEBUG ) console.log( JSON.stringify( shares ) );
			if ( DEBUG ) console.log( "Got Shares" );

			if ( typeof callback !== "undefined" ) callback();
		} );
}

function getUserData()
{
	ajax(
		{
			url: api + "/user",
			type: "json",
			method: "get",
			headers: header,
			cache: false
		},
		function ( userData )
		{
			Settings.data( "user", userData );
		},
		function ( error )
		{
			if ( DEBUG ) console.log( "Getting User Data Failed: " + JSON.stringify( error ) );
			reportError( "Getting User Data: " + JSON.stringify( error ) );
		} );
}

function getTextColor()
{
	if ( Settings.option( "theme" ) == 'dark' )
		return 'white';
	else
		return 'black';
}

function getBGColor()
{
	if ( Settings.option( "theme" ) == 'dark' )
		return 'black';
	else
		return 'white';
}

function getHighlightTextColor()
{
	if ( Feature.blackAndWhite() )
	{
		if ( Settings.option( "theme" ) == 'dark' )
			return 'black';
		else
			return 'white';
	}
	else
	{
		return 'white';
	}
}

function getHighlightBGColor()
{
	if ( Feature.blackAndWhite() )
	{
		if ( Settings.option( "theme" ) == 'dark' )
			return 'white';
		else
			return 'black';
	}
	else
	{
		if ( Settings.option( "color" ) )
			return Settings.option( "color" );
		else
			return 'blue';
	}
}

function getURIOptions()
{
	// Remove old and unused settings
	if ( VERSION >= 2.11 )
	{
		Settings.option( 'access_token', null );
		Settings.option( 'settings', null );
		Settings.option( 'token_type', null );
	}

	var data = Settings.option();

	data.platform = Platform.version();
	data.hasColor = Feature.color();

	data = JSON.stringify( data );

	if ( DEBUG ) console.log( 'Encoding Options:' );
	if ( DEBUG ) console.log( data );

	return encodeURIComponent( data );
}

// EVENT HANDLERS
function clickOnList( e )
{
	if ( DEBUG ) console.log( "Viewing Tasks For: " + e.item.title );

	if ( Platform.version() === 'basalt' )
	{
		var loading = new UI.Card(
		{
			banner: Feature.round( 'images/loading-round.png', 'images/loading.png' )
		} );

		loading.show();
	}

	try
	{
		if ( e.item.type == 'folder' )
		{
			getLists( e.item.id, function ()
			{
				sublistMenu.show();
				if ( Platform.version() === 'basalt' ) loading.hide();
			} );
		}
		else
		{
			getTaskPositions( e.item.id, function ()
			{
				getTasks( e.item.id, e.item.title, function ()
				{
					if ( taskItems )
					{
						taskMenu.show();
						if ( Platform.version() === 'basalt' ) loading.hide();
					}
					else
					{
						error.body( "\nNo tasks were found for this list" );
						error.show();
						if ( Platform.version() === 'basalt' ) loading.hide();
					}

					taskItems = 0;
				} );
			} );
		}
	}
	catch ( err )
	{
		reportError( "List Selected: " + err.message );
	}
}

function clickOnTask( e )
{
	if ( DEBUG ) console.log( "Selected Task: " + e.item.title );

	try
	{
		getTask( e.item.data );
	}
	catch ( err )
	{
		reportError( "Task Selected: " + err.message );
	}
}

function longClickOnTask( e )
{
	try
	{
		completeTask( e );
	}
	catch ( err )
	{
		reportError( "Marked Task Complete: " + err.message );
	}
}

// UTILITY FUNCTIONS
function sortItems( a, b )
{
	if ( a.position < b.position )
		return -1;
	if ( a.position > b.position )
		return 1;
	// a must be equal to b
	return 0;
}

function cleanTitle( title )
{
	try
	{
		if ( title )
			return decodeURIComponent( escape( title ) ).replace( /([\uD800-\uDBFF][\uDC00-\uDFFF])/g, "" ).trim();
		else
			return title;
	}
	catch ( err )
	{
		reportError( "Cleaning Title: Failed to clean" + title );
		return title;
	}
}

function reportError( err )
{
	if ( DEBUG ) console.log( "Reporting Error" );
	var today = new Date();

	if ( Settings.option( "reporting" ) )
	{
		ajax(
			{
				url: reporting,
				type: "string",
				method: "post",
				data:
				{
					timestamp: today.toISOString(),
					error: err,
					identifier: Settings.data( "user" ).email,
					version: VERSION
				}
			},
			function ( data )
			{
				if ( DEBUG ) console.log( "Error Reported: " + err );
				if ( DEBUG ) console.log( data );
			},
			function ( err )
			{
				if ( DEBUG ) console.log( "Error Report Failed: " + JSON.stringify( err ) );
			} );
	}
	else
		return false;
}

function flowForRound( text, lines )
{
	var output = "";

	for ( var i = 0; i < text.length; i++ )
	{
		// All lines except last
		if ( i < lines.length - 1 )
		{
			var spaceIndex = text.substr( 0, lines[ i ] ).lastIndexOf( ' ' );

			output += text.substr( 0, spaceIndex ).trim() + "\n";
			text = text.substr( spaceIndex + 1 );
		}
		else
		{
			// If final line fits perfectly
			if ( text.substr( lines[ i ] + 1 ) === '' )
			{
				output += text.substr( 0, lines[ i ] ).trim();
			}
			// If final line needs ellipsis, but words fit
			else if ( text.substr( 0, lines[ i ] ).trim().length <= lines[ i ] - 3 )
			{
				output += text.substr( 0, lines[ i ] ).trim() + "...";
			}
			// If we have to cut words to fit ellipsis
			else
			{
				output += text.substr( 0, lines[ i ] - 3 ).trim() + "...";
			}

			break;
		}
	}

	return output;
}