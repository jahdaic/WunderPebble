/**
 * WunderPebble
 * By: Jahdai Cintron
 * http://jahdaicintron.com/wunderpebble
 */
// DEBUGGING
var DEBUG = true;

// INCLUDES
var UI       = require( "ui" );
var ajax     = require( "ajax" );
var Settings = require( "settings" );
var Vector2  = require( "vector2" );

// GLOBAL VARIABLE
var api           = "https://a.wunderlist.com/api/v1";
var clientID      = "";
var header        = "";
var reporting     = "http://jahdaicintron.com/wunderpebbleconfig/report.php";
var refreshed     = false;
var taskItems     = 0;
var shares        = [];
var listPositions = [];
var taskPositions = [];
var listsList     = { inbox: "Inbox", today: "Today", week: "Week" };
var days          = [ "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday" ];

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
		if( "token_type" in data ) Settings.option( "token_type", data.token_type );
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
var taskMenu = new UI.Menu( {sections: [{items:[]}] } );
var task = new UI.Window({
	//action: {
	//	up: "images/task-done.png",
	//	down: "images/task-trash.png",
	//	backgroundColor: "black"
	//},
	backgroundColor: "white"
});

// ICON
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
noConfig.on( "select", function( e )
{
	if( typeof Settings.option( "token" ) !== "undefined" && Settings.option( "token" ) !== null )
	{
		try
		{
			header = { "X-Access-Token": Settings.option( "token" ), "X-Client-ID": clientID, contentType: "application/json; charset=utf-8" };
			getShares( getListPositions( getLists() ) );
		}
		catch( err )
		{
			reportError( err.message );
		}
		
		listMenu.show();
		noConfig.hide();
	}
});

listMenu.on( "select", function(e)
{
	console.log( "Selected List Item: " + e.item.title );
	
	loading.show();
	
	try
	{
		getTaskPositions( e.item.id, getTasks( e.item.id, e.item.title ) );
	}
	catch( err )
	{
		reportError( err.message );
	}
	
	onRefresh( function() {
		if( taskItems )
		{
			console.log( "We have items" );
			taskMenu.show();
			loading.hide();
		}
		else
		{
			console.log( "No items" );
			error.body( "\nNo tasks were found for this list" );
			error.show();
			loading.hide();
		}
		
		taskItems = 0;
	});
});

taskMenu.on( "select", function( e )
{
	console.log( "Selected Task: " + e.item.title );
	
	try
	{
		getTask( e.item.data );
	}
	catch( err )
	{
		reportError( err.message );
	}
	
	task.show();
});

//task.on("click", "up", function(e) {
//	markTaskComplete(task.id);
//	getTasks(taskMenu.id, taskMenu.list);
//});

//task.on("click", "down", function(e) {
//	deleteTask(task.id);
//	getTasks(taskMenu.id, taskMenu.list);
//});

// PROGRAM START
if( typeof Settings.option( "token" ) !== "undefined" && Settings.option( "token" ) !== null )
{
	splash.show();
	
	try
	{
		header = { "X-Access-Token": Settings.option( "token" ), "X-Client-ID": clientID, contentType: "application/json; charset=utf-8" };
		getShares( getListPositions( getLists() ) );
	}
	catch( err )
	{
		reportError( err.message );
	}
	
	onRefresh( function() {
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
		url:     api + "/lists",
		type:    "json",
		method:  "get",
		headers: header,
		cache:   false
	},
	function( data )
	{
		try
		{
			if (DEBUG) console.log( "Lists Data: " + JSON.stringify( data ) );

			//var lists = [
			//	{
			//		title: "Inbox",
			//		icon: "images/inbox.png",
			//		id: "inbox"
			//	},
			//	{
			//		title: "Today",
			//		icon: "images/today.png",
			//		id: "today"
			//	},
			//	{
			//		title: "Week",
			//		icon: "images/week.png",
			//		id: "week"
			//	}
			//];
			
			var lists = [];

			for ( var i = 0; i < data.length; i++ )
			{
				if ( data[i].title == "inbox" )
				{
					listPositions.splice( listPositions.indexOf( data[i].id), 1 );
					listPositions.unshift( data[i].id );
					
					lists.push(
					{
						title:    "Inbox",
						icon:     "images/inbox.png",
						id:       data[i].id,
						position: -1
					});
				}
				else
				{
					lists.push(
					{
						title:    data[i].title,
						icon:     ( shares.indexOf( data[i].id ) > -1 ) ? "images/group.png" : "images/list.png",
						id:       data[i].id,
						position: listPositions.indexOf( data[i].id )
					});
				}

				listsList[ data[i].id ] = data[i].title;
			}
			
			lists.sort( sortItems );

			listMenu.items( 0, lists );

			refreshed = true;

			if (DEBUG) console.log( "Done Getting Lists" );
		}
		catch( err )
		{
			reportError( err.message );
		}
	},
	function( error )
	{
		if (DEBUG) console.log( "Getting Lists Failed: " + JSON.stringify( error ) );		
		reportError( JSON.stringify( error ) );
	});
}


function getTasks( id, list )
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
			console.log( "Tasks Data: " + JSON.stringify( data ) );

			var today = new Date();

			var tomorrow = new Date();
			tomorrow.setDate( tomorrow.getDate() + 1 );

			var yesterday = new Date();
			yesterday.setDate( yesterday.getDate() - 1 );

			var timeZone = new Date().toTimeString().slice( 12, 17 );
			timeZone = String( timeZone ).slice( 0, 3 ) + ":" + String( timeZone ).slice( 3 );
			console.log( timeZone );

			if ( id == "today" )
			{
				var taskSections = { sections: [] };						
				var sectionsList = [];
						
				for ( var i = 0; i < data.length; i++ )
				{
					if ( data[i].due_date && data[i].title )
					{
						var dateString = data[i].due_date + "T00:00" + timeZone;
						var date = new Date( dateString );

						if ( date.getTime() <= today.getTime() && data[i].completed_at === null )
						{
							taskItems++;

							var icon = ( data[i].starred ) ? "images/star.png" : "images/task.png";
														
							if ( sectionsList.indexOf( listsList[ data[i].list_id ] ) == -1 )
							{	
								sectionsList.push( listsList[ data[i].list_id ] );
								taskSections.sections.push( { title: listsList[ data[i].list_id ], items:[] } );
								taskSections.sections[ sectionsList.indexOf( listsList[ data[i].list_id ] ) ].items.push(
								{
									title:    data[i].title,
									subtitle: "Today",
									icon:     icon,
									data:     data[i]
								});
							}
							else
							{
								taskSections.sections[ sectionsList.indexOf( listsList[ data[i].list_id ] ) ].items.push(
								{
									title: data[i].title,
									subtitle: "Today",
									icon: icon,
									data: data[i]
								});
							}
						}
					}
				}
				taskMenu = new UI.Menu( taskSections );
			}
			else if( id == "week" )
			{
				var week = new Date();
				week.setDate( week.getDate() + 6 );
				
				var i = today.getDay();

				var taskSections = {
					sections: [
						{ title: "Today", items:[] },
						{ title: "Tomorrow", items:[] },
						{ title: days[ i + 2 - ( ( i + 2 > 6 ) ? 7 : 0 ) ], items:[] },
						{ title: days[ i + 3 - ( ( i + 3 > 6 ) ? 7 : 0 ) ], items:[] },
						{ title: days[ i + 4 - ( ( i + 4 > 6 ) ? 7 : 0 ) ], items:[] },
						{ title: days[ i + 5 - ( ( i + 5 > 6 ) ? 7 : 0 ) ], items:[] },
						{ title: days[ i + 6 - ( ( i + 6 > 6 ) ? 7 : 0 ) ], items:[] },
					]
				};

				for ( var i = 0; i < data.length; i++ )
				{
					if ( data[i].due_date && data[i].title )
					{
						var dateString = data[i].due_date + "T00:00" + timeZone;
						var date = new Date( dateString );

						if ( date.getTime() < week.getTime() && data[i].completed_at === null )
						{
							taskItems++;

							var icon = ( data[i].starred ) ? "images/star.png" : "images/task.png";

							var index = ( date.getTime() < today.getTime() ) ? 0 : ( date.getDay() - today.getDay() + ( ( ( date.getDay() - today.getDay() ) < 0 ) ? 7 : 0 ) );

							if (DEBUG) console.log( data[i].title + " - " + index );

							taskSections.sections[ index ].items.push(
							{
								title:    data[i].title,
								subtitle: listsList[ data[i].list_id ],
								icon:     icon,
								data:     data[i]
							});
						}
					}
				}

				// loop through removing empty sections
				for ( var i = 0; i < taskSections.sections.length; i++ )
				{
					if ( !taskSections.sections[i].items.length )
					{
						taskSections.sections.splice( i, 1 );
						i--;
					}
				}
				taskMenu = new UI.Menu( taskSections );			
			}
			else
			{
				taskMenu = new UI.Menu( { sections: [ { items:[] } ] } );
				var tasks = [];
				
				for ( var i = 0; i < data.length; i++ )
				{
					if ( data[i].list_id == id && !data[i].completed )
					{
						taskItems++;

						var dateString = data[i].due_date + "T00:00" + timeZone;
						var date = new Date( dateString );

						if ( !data[i].due_date )
							date = "";
						else if ( date.toDateString() == today.toDateString() )
							date = "Today";
						else if ( date.toDateString() == tomorrow.toDateString() )
							date = "Tomorrow";
						else if ( date.toDateString() == yesterday.toDateString() )
								date = "Yesterday";
						else
						{
							date = date.toISOString().slice( 0, 10 ).split( "-" );
							date = date[1] + "." + date[2] + "." + date[0];
						}

						var icon = ( data[i].starred ) ? "images/star.png" : "images/task.png";

						tasks.push(
						{
							title:    data[i].title,
							subtitle: date,
							icon:     icon,
							data:     data[i],
							position: taskPositions.indexOf( data[i].id )
						});	
					}
				}
				
				tasks.sort( sortItems );
				taskMenu.section( 0, { title: list, items: [] } );
				taskMenu.items( 0, tasks );
			}

			taskMenu.id = id;
			taskMenu.list = list;

			taskMenu.on( "select", function( e )
			{
				if (DEBUG) console.log( "Selected Task: " + e.item.title );

				try
				{
					getTask( e.item.data );
				}
				catch( err )
				{
					reportError( err.message );
				}

				task.show();
			});

			taskMenu.on( "longSelect", function( e )
			{
				try
				{
					completeTask( e );
				}
				catch( err )
				{
					reportError( err.message );
				}
			});

			refreshed = true;

			console.log( "Done Getting " + taskItems + " Tasks" );
		}
		catch( err )
		{
			reportError( err.message );
		}
	},
	function( err )
	{
		console.log( "Getting Tasks Failed: " + JSON.stringify( err ) );
		reportError( JSON.stringify( err ) );
	});
}


function getTask( data )
{
	if (DEBUG) console.log( "Getting Task" );
	
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
			if (DEBUG) console.log( JSON.stringify( note ) );
			
			// Clear Window
			task.each( function( element ) {
				task.remove( element );
			});
			
			var timeZone = new Date().toTimeString().slice( 12, 17 );
			timeZone = String( timeZone ).slice( 0, 3 ) + ":" + String( timeZone ).slice( 3 );
			if (DEBUG) console.log( timeZone );
			
			var dateString = data.due_date + "T00:00" + timeZone;
			var displayDate = new Date( dateString );
			
			var today = new Date();

			var tomorrow = new Date();
			tomorrow.setDate( tomorrow.getDate() + 1 );
			
			var yesterday = new Date();
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
				size:      new Vector2( 100, 30 ),
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
		}
		catch( err )
		{
			reportError( err.message );
		}
	},
	function( err )
	{
		if (DEBUG) console.log( "Getting Task Failed: " + JSON.stringify( err ) );
		reportError( JSON.stringify( err ) );
	});		
}


function completeTask( event )
{
	if (DEBUG) console.log( "Changing Complete Status" );

	var date = new Date().toISOString();
	date = date.slice( 0, date.indexOf( "T" ) );
			
	ajax(
	{
		url:     api + "/tasks/" + event.item.data.id,
		type:    "json",
		method:  "patch",
		headers: header,
		data:    { revision: event.item.data.revision, completed: !event.item.data.completed }
	},
	function( data )
	{
		if (DEBUG) console.log( JSON.stringify( data ) );
		
		if ( data.completed )
		{
			if (DEBUG) console.log( "Task Marked Complete" );
			
			taskMenu.item( event.sectionIndex, event.itemIndex, { title: event.item.title, subtitle: event.item.subtitle, icon: "images/done.png", data: data, position: event.item.position } );
		}
		else
		{
			if (DEBUG) console.log( "Task Marked Incomplete" );
			taskMenu.item( event.sectionIndex, event.itemIndex, { title: event.item.title, subtitle: event.item.subtitle, icon: "images/task.png", data: data, position: event.item.position } );
		}
	},
	function( err )
	{
		if (DEBUG) console.log( "Completing Task Failed: " + JSON.stringify( err ) );
		reportError( JSON.stringify( err ) );
	});
}


function deleteTask( id )
{
	var date = new Date().toISOString();
	date = date.slice( 0, date.indexOf( "T" ) );
		
	ajax(
	{
		url:     api + "/me/" + id,
		type:    "json",
		method:  "delete",
		headers: header
	},
	function( data )
	{
		if (DEBUG) console.log( "Task Data: " + JSON.stringify( data ) );
		if (DEBUG) console.log( "Deleted Task" );
	},
	function( err )
	{
		if (DEBUG) console.log( "Deleting Task Failed: " + JSON.stringify( err ) );
		reportError( JSON.stringify( err ) );
	});
}


function getListPositions( callback )
{
	if (DEBUG) console.log( "Getting List Positions" );
	
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
			if ( DEBUG ) console.log( JSON.stringify(data) );
			
			listPositions = data[0].values;
			
			if (DEBUG) console.log( "Got List Positions" );
			
			if ( typeof callback !== "undefined" ) callback();
		}
		catch( err )
		{
			reportError( err.message );
		}
	},
	function( err )
	{
		if (DEBUG) console.log( "Getting List Positions Failed: " + JSON.stringify( err ) );
		reportError( JSON.stringify( err ) );
	});
}

function getTaskPositions( id, callback )
{
	if (DEBUG) console.log( "Getting Task Positions: " + id );
	
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
			if (DEBUG) console.log( JSON.stringify( data.values ) );
			
			taskPositions = data[0].values;
			
			if (DEBUG) console.log( "Got Task Positions" );
			
			if ( typeof callback !== "undefined" ) callback();
		}
		catch( err )
		{
			reportError( err.message );
		}
	},
	function( err )
	{
		if (DEBUG) console.log( "Getting Task Positions Failed: " + JSON.stringify( err ) );
		reportError( JSON.stringify( err ) );
	});
}

function getShares( callback )
{
	if (DEBUG) console.log( "Getting Shares" );
	
	ajax(
	{
		url:     api + "/memberships",
		type:    "json",
		method:  "get",
		headers: header
	},
	function( data )
	{
		try
		{
			for ( var i = 0; i < data.length; i++ )
			{
				if( shares.indexOf( data[i].list_id ) == -1 && "created_by_request_id" in data[i] && data[i].created_by_request_id !== null )
				{
					shares.push( data[i].list_id );
				}
			}
			
			if (DEBUG) console.log( JSON.stringify( shares ) );
			if (DEBUG) console.log( "Got Shares" );
			
			if( typeof callback !== "undefined" ) callback();
		}
		catch( err )
		{
			reportError( err.message );
		}
	},
	function( err )
	{
		if (DEBUG) console.log( "Getting Shares Failed: " + JSON.stringify( err ) );
		reportError( JSON.stringify( err ) );
	});
}


// UTILITY FUNCTIONS
function onRefresh( callback )
{
	setTimeout( function()
	{
		if( refreshed )
		{
			callback();
			refreshed = false;
		}
		else
		{
			onRefresh( callback );
		}
	}, 200);
}


function sortItems( a, b )
{
	if ( a.position < b.position )
		return -1;
	if ( a.position > b.position )
		return 1;
	// a must be equal to b
		return 0;
}


function reportError( err )
{
	if (DEBUG) console.debug( err );
	
	var today = new Date();

	if ( Settings.option( "reporting" ) )
	{
		ajax(
		{
			url:    reporting,
			type:   "string",
			method: "post",
			data:   { date: today.toISOString(), error: err, identifier: Settings.option( "token" ) }
		},
		function( data )
		{
			if (DEBUG) console.log( "Error Reported" );
			if (DEBUG) console.log( data );
		},
		function(error)
		{
			if (DEBUG) console.log( "Error Report Failed" );
		});
	}
	else
		return false;
}