        var obs_server_address              = '';
        var obs_server_password             = '';

        // Client settings _________________________________________________________________________ BEGIN
		var lock_buttons			        = '';
    	
        var obs_server                      = {};
        var con_client_credentials          = {};

        var obs_connect				        = false;
        var obs_message_id                  = 1;
        var obs_commands_stack              = {};
        var obs_scenes_indexes              = {};
        var obs_streaming                   = false;
        var obs_recording                   = false;

        var con_scenes_transitions          = {};
        var obs_current_scene               = '';
        var obs_current_transition_duration = 0;
        var obs_current_transition          = '';
        var obs_transition_list             = {};
        
        var con_scene_buttons_lock          = false;
        var con_main_out_audio_source       = '';
        var con_main_in_audio_source        = '';

        var obs_sources                     = {};
        var obs_cameras                     = {};
        var obs_images                      = {};
        var obs_audio                       = {};
        var obs_browsers                    = {};
        var obs_monitors_capture            = {};
        var obs_games_capture               = {};

        
        window.onload                       = function() {
            
            con_client_credentials = con_load_config('client_credentials');

            if ( !$.isEmptyObject(con_client_credentials) ) {
                console.log('Сlient credentials loaded from local storage.');
                $('#obs_server_address').val(con_client_credentials['server_address']);
                $('#obs_server_port').val(con_client_credentials['server_port']);
                $('#obs_server_password').val(con_client_credentials['server_password']);
            }
            $('#client-connection').show();
        }


		function obs_connection_open( event ){
            
            obs_connect 			= true;
            
            console.log("Conncetion with " + obs_server_address + " established.");
		    console.log("Authorization begin.");
            obs_request("GetAuthRequired");

        }

        function obs_connection_close( event ) {
  		
  		    if (event.wasClean) {
  			    obs_connect		    = false;
                $("#client-connection").show();
                $('#error-place').html('<i class="fas fa-exclamation-circle"></i> <b>OBS:</b> OBS closed connection.');
    		    console.log('Connection closed.');
  		    } else {
  			    obs_connect		    = false;
                $("#client-connection").show();
                $('#error-place').html('<i class="fas fa-exclamation-circle"></i> <b>OBS:</b> Connection terminated. Please check OBS then re-connect.');
    		    console.log('Connection terminated.');
                console.log( 'Disconnect code: ' + event.code + ' Reason: ' + event.reason );
  		    }
            $("#status").removeClass().addClass("shutdown");		
            $("#control").removeClass().addClass("offline");
  		
	    }        

        function obs_connection_error(error) {
		    //console.log(error);
		    console.log( "Error: " + error.message );
	    }

        function connect_to_obs() {
            
            let check = check_credentials();

            if ( check === true ) {
                
                obs_server_address                  = 'ws://' + $('#obs_server_address').val() + ':' + $('#obs_server_port').val();
                obs_server_password                 = $('#obs_server_password').val();
                obs_server                          = new WebSocket( obs_server_address );
                obs_server.onopen                   = function( event ) { obs_connection_open( event ) };
                obs_server.onclose                  = function( event ) { obs_connection_close( event ) };
                obs_server.onerror                  = function( error ) { obs_connection_error( error ) };
                obs_server.onmessage                = function( event ) { obs_manage_messages( event ) };

                con_client_credentials['server_address']   = $('#obs_server_address').val();
                con_client_credentials['server_port']      = $('#obs_server_port').val();
                con_client_credentials['server_password']  = $('#obs_server_password').val();

            } else {
                switch ( check ) {
                    case 'address_error':
                        $('#error-place').html('<i class="fas fa-exclamation-circle"></i> <b>Connection error:</b> Wrong OBS client address.');
                    break;
                    case 'port_error':
                        $('#error-place').html('<i class="fas fa-exclamation-circle"></i> <b>Connection error:</b> Wrong OBS client port number.');
                    break;
                    default:
                        $('#error-place').html('<i class="fas fa-exclamation-circle"></i> <b>Error:</b> Unknow error.');
                }
            }

        }

        function check_credentials() {
            if ( $('#obs_server_address').val() == '' ) {
                return 'address_error';
            }
            if ( $('#obs_server_port').val() == '' ) {
                return 'port_error';
            }
            return true;
        }





        function obs_manage_messages( event ) {
            if ( event.data != '' ) {
                var event_data = JSON.parse(event.data);
                if ( "message-id" in event_data ) {
                    switch ( event_data["status"] ) {
                        case "ok":
                            obs_manage_commands( obs_commands_stack[event_data["message-id"]], event_data );
                            delete(obs_commands_stack[event_data["message-id"]]);
                        break;
                        case "error":
                            obs_manage_errors( event_data );
                        break;
                    }
                } else if ( "update-type" in event_data ) {
                    obs_manage_events( event_data["update-type"], event_data );
                }
            }
        }

        function obs_request( request_type, data = {} ) {
            
            data["request-type"]    = request_type;
            data["message-id"]      = String(obs_message_id);
            
            obs_server.send( JSON.stringify( data ) );
            obs_commands_stack[String(obs_message_id)] = request_type;
            obs_message_id++;
            
        }


        function obs_manage_errors( event_data ) {
            if ( "message-id" in event_data ) {
                
                console.log( "Command: " + obs_commands_stack[event_data["message-id"]] + " has error." );
                //console.log( event_data );
                
                switch ( obs_commands_stack[event_data["message-id"]] ) {
                    case 'Authenticate':
                        $("#client-connection").show();
                        $('#error-place').html('<i class="fas fa-exclamation-circle"></i> <b>Connection error:</b> Incorrect password.');

                        delete(obs_commands_stack[event_data["message-id"]]);
                    break;
                    default:
                        delete(obs_commands_stack[event_data["message-id"]]);
                }
                
            } else {
                console.log( "Error event found." );
                //console.log( event_data );
            }
        }


        function obs_manage_events( update_type, event_data ) {
            switch ( update_type ) {
                
                case "TransitionBegin":
                    con_scene_buttons_lock  = true;
                    
                    $(obs_scenes_indexes[event_data["from-scene"]]).removeClass("active").addClass("standby");
                    $(obs_scenes_indexes[event_data["from-scene"]]+" > .scene").attr("onclick", 'set_scene("'+event_data["from-scene"]+'");');
                    
                    $(obs_scenes_indexes[event_data["to-scene"]]).removeClass("standby").addClass("ready");
                    $(obs_scenes_indexes[event_data["to-scene"]]+" > .scene").removeAttr("onclick");
                break;
                case "SwitchScenes":
                    $(obs_scenes_indexes[event_data["scene-name"]]).removeClass("ready").addClass("active");
                    console.log( "Switch to scene '" + event_data["scene-name"] + "' complete" );
                    obs_current_scene       = event_data["scene-name"];
                    con_scene_buttons_lock  = false;
                    obs_request( "GetSceneList" );
                break;
                
                case "StreamStarting":
                break;
                case "StreamStarted":
                    obs_streaming = true;
                    $("#stream-start-stop > i").removeClass("fa-video").addClass("fa-video-slash");
                    $("#stream-start-stop").removeClass().addClass("on");
                    $("#status").removeClass().addClass("stream");
                break;
                case "RecordingStarting":
                break;
                case "RecordingStarted":
                    obs_recording = true;
                    $("#record-start-stop > i").removeClass("fa-circle").addClass("fa-stop");
                    $("#record-start-stop").removeClass().addClass("on");
                break;

                case "StreamStopping":
                break;
                case "StreamStopped":
                    obs_streaming = false;
                    $("#stream-start-stop > i").removeClass("fa-video-slash").addClass("fa-video");
                    $("#stream-start-stop").removeClass();
                    $("#status").removeClass().addClass("ready");
                break;
                case "RecordingStopping":
                break;
                case "RecordingStopped":
                    obs_recording = false;
                    $("#record-start-stop > i").removeClass("fa-stop").addClass("fa-circle");
                    $("#record-start-stop").removeClass();
                break;

                case "StreamStatus":
                    $('.dropframes').html( event_data['num-dropped-frames'] + 'DF' );
                    $('.bandwidth').html( event_data['kbits-per-sec'] +'Kbps' );
                    $('.fps').html( Math.round( event_data['fps'] ) + 'fps' );
                    $('.timecode').html('Timecode:<br/><b>' + event_data['stream-timecode'] + '</b>');
                    $('.totalframes').html('Total frames:<br/><b>' + event_data['num-total-frames'] + '</b>' );
                    $('.strain').html('Strain:<br/><b>' + Math.round(event_data['strain']) + '</b>');
                break;
                
                case "TransitionListChanged":
                    console.log("Transition list updated.");
                    console.log("Requesting transition list from OBS.");
                    obs_request("GetTransitionList");
                break;

                case 'SceneItemVisibilityChanged':
                    switch ( obs_sources[event_data['item-name']] ) {
                        case 'obs_cameras':
                            //console.log( event_data );        
                            console.log( "Camera state changed." );
                            obs_cameras[event_data['item-name']]['render'] = event_data['item-visible'];
                            if ( $('div').is(obs_cameras[event_data['item-name']]['con_id']) ) {
                                if ( obs_cameras[event_data['item-name']]['render'] ) {
                                    $(obs_cameras[event_data['item-name']]['con_id'] + '> i').removeClass('fa-eye-slash').addClass('fa-eye');
                                    $(obs_cameras[event_data['item-name']]['con_id']).removeClass('hided');
                                } else {
                                    $(obs_cameras[event_data['item-name']]['con_id'] + '> i').removeClass('fa-eye').addClass('fa-eye-slash');
                                    $(obs_cameras[event_data['item-name']]['con_id']).addClass('hided');
                                }
                            }
                        break;
                    }
                break;

                default:
                    console.log( "[DEBUG-EVENT] Event: " + update_type );
                    //console.log( event_data );
            }
        }

        function obs_manage_commands( command, data ) {

            switch ( command ) {
                case 'GetAuthRequired':
                    if ( data['authRequired'] === true ) {
                        
                        var secret          = '';
                        var auth_response   = '';
                        var hash_step_1     = sha256.create();
                        var hash_step_2     = sha256.create();
                        
                        hash_step_1.update( obs_server_password + data['salt'] );
                        secret = btoa(String.fromCharCode.apply(null, new Uint8Array( hash_step_1.arrayBuffer() )));
                        hash_step_2.update( secret + data['challenge'] );
                        auth_response = btoa(String.fromCharCode.apply(null, new Uint8Array( hash_step_2.arrayBuffer() )));
                        obs_request( "Authenticate", { "auth" : auth_response } );

                    } else {
                        console.log( "No future authorization required." );
                        console.log( "Connection to OBS complete." );
                        panel_init();
                    }
                break;
                
                case 'Authenticate':
                    console.log( "Authorization complete." );
                    panel_init();
                break;
                
                case 'GetSceneList':
                    //console.log(data);
                    if ( 'scenes' in data ) {
                        
                        if ( obs_current_transition_duration == 0) {
                            obs_current_transition_duration = 300;
                        }
                        
                        con_scenes_transitions = con_load_config('transition_per_scene');
                        if ( !$.isEmptyObject(con_scenes_transitions) ) {
                            console.log('Transitions per scene loaded from local storage');
                            var load_mode           = true;
                        } else {
                            console.log('Transitions per scene not found in local storage');
                            var load_mode           = false;
                        }

                        //Hide main sources buttons.
                        $('#microphone-on-off').hide();
                        $('#global-sound-on-off').hide();

                        data.scenes.forEach( function( item, index, sub_array ){
                            $('#p'+index).removeClass("disable");
                            obs_scenes_indexes[item.name] = '#p'+index;
                            
                            if ( load_mode ) {
                                var current_scene_transition        = con_scenes_transitions[item.name];
                                var current_transition_duration     = obs_current_transition_duration;
                            } else {
                                var current_scene_transition        = obs_current_transition;
                                var current_transition_duration     = obs_current_transition_duration;
                                con_scenes_transitions[item.name]   = current_scene_transition;
                            }
                            
                            if ( data['current-scene'] == item.name ) {
                                
                                obs_current_scene = item.name;
                                
                                // Init scene button
                                $('#p'+index).html('<div class="scene"><p>Scene:</p><b>'+item.name+'</b></div><div class="transition" onclick="select_transition(\''+item.name+'\')"><p>OUT transition:</p><b>'+current_scene_transition+'</b></div>');
                                $('#p'+index).addClass("active");
                                $('#source-control').html('');

                                // Init sources section button
                                for ( var sources_id in item.sources ) {
                                    
                                    // Show/Hide main sources buttons.
                                    if ( item.sources[sources_id].name == con_main_out_audio_source  ) {
                                        $('#global-sound-on-off').show();
                                    }
                                    if ( item.sources[sources_id].name == con_main_in_audio_source  ) {
                                        $('#microphone-on-off').show();
                                    }
                                    
                                    // Show audio sources list.
                                    if ( item.sources[sources_id].name in obs_audio && obs_audio[item.sources[sources_id].name]['type'] != 'main-in' && obs_audio[item.sources[sources_id].name]['type'] != 'main-out' ) {
                                        if ( !$('#source-control').children().is('#scene-audio') ) {
                                            $('#source-control').append('<div id="scene-audio"><h2>Scene I/O aduio source control:</h2></div>');
                                        }
                                        $('#source-control > #scene-audio').append('<div id="'+obs_audio[item.sources[sources_id].name]['con_id'].substring(1)+'" onclick="set_audio_mute_unmute(\''+item.sources[sources_id].name+'\')"><i class="fas fa-volume-up"></i><b class="button-label">'+item.sources[sources_id].name+'</b></div>');
                                    }

                                    // Show browsers source list
                                    if ( item.sources[sources_id].name in obs_browsers ) {
                                        if ( !$('#source-control').children().is('#scene-browsers') ) {
                                            $('#source-control').append('<div id="scene-browsers"><h2>Web widgets control:</h2></div>');
                                        }
                                        $('#source-control > #scene-browsers').append('<div id="'+obs_browsers[item.sources[sources_id].name]['con_id'].substring(1)+'" onclick="refresh_web_source(\''+item.sources[sources_id].name+'\')" class="refresh"><i class="fas fa-sync-alt"></i><b class="button-label">REFRESH: '+item.sources[sources_id].name+'</b></div>');
                                    }

                                    // Show cameras source list
                                    if ( item.sources[sources_id].name in obs_cameras ) {
                                        if ( !$('#source-control').children().is('#scene-cameras') ) {
                                            $('#source-control').append('<div id="scene-cameras"><h2>Scene cameras:</h2></div>');
                                        }
                                        obs_cameras[item.sources[sources_id].name].render = item.sources[sources_id].render;
                                        
                                        if ( obs_cameras[item.sources[sources_id].name].render ) {
                                            $('#source-control > #scene-cameras').append('<div id="'+obs_cameras[item.sources[sources_id].name]['con_id'].substring(1)+'" onclick="set_camera_on_off(\''+item.sources[sources_id].name+'\')"><i class="fas fa-eye"></i><b class="button-label">'+item.sources[sources_id].name+'</b></div>');
                                        } else {
                                            $('#source-control > #scene-cameras').append('<div id="'+obs_cameras[item.sources[sources_id].name]['con_id'].substring(1)+'" onclick="set_camera_on_off(\''+item.sources[sources_id].name+'\')" class="hided"><i class="fas fa-eye-slash"></i><b class="button-label">'+item.sources[sources_id].name+'</b></div>');
                                        }
                                    }
                                }

                                // Show special audio source.
                                for ( var sources_id in obs_audio ) {
                                    if ( obs_audio[sources_id].type != 'default' && obs_audio[sources_id].type != 'main-in' && obs_audio[sources_id].type != 'main-out' ) {
                                        if ( !$('#source-control').children().is('#obs-audio') ) {
                                            $('#source-control').append('<div id="obs-audio"><h2>OBS I/O audio source control:</h2></div>');
                                        }
                                        $('#source-control > #obs-audio').append('<div id="'+obs_audio[sources_id]['con_id'].substring(1)+'" onclick="set_audio_mute_unmute(\''+sources_id+'\')"><i class="fas fa-volume-up"></i><b class="button-label">'+sources_id+'</b></div>');
                                        if ( obs_audio[sources_id]['type'] == 'microphone' ) {
                                            //console.log(obs_audio[sources_id]['type']);
                                            //console.log(obs_audio[sources_id]['con_id']);
                                            $(obs_audio[sources_id]['con_id']+' > i').removeClass('fa-volume-up');
                                            $(obs_audio[sources_id]['con_id']+' > i').addClass('fa-microphone');
                                        }
                                        if ( obs_audio[sources_id]['mute'] ) {
                                            $(obs_audio[sources_id]['con_id']).addClass('muted');
                                            if ( $(obs_audio[sources_id]['con_id']+' > i').hasClass('fa-volume-up') ) {
                                                $(obs_audio[sources_id]['con_id']+' > i').removeClass('fa-volume-up').addClass('fa-volume-mute');
                                            } else if (  $(obs_audio[sources_id]['con_id']+' > i').hasClass('fa-microphone') ) {
                                                $(obs_audio[sources_id]['con_id']+' > i').removeClass('fa-microphone').addClass('fa-microphone-slash');
                                            }
                                        } else {
                                            $(obs_audio[sources_id]['con_id']).removeClass('muted');
                                            if ( $(obs_audio[sources_id]['con_id']+' > i').hasClass('fa-volume-mute') ) {
                                                $(obs_audio[sources_id]['con_id']+' > i').removeClass('fa-volume-mute').addClass('fa-volume-up');
                                            } else if (  $(obs_audio[sources_id]['con_id']+' > i').hasClass('fa-microphone-slash') ) {
                                                $(obs_audio[sources_id]['con_id']+' > i').removeClass('fa-microphone-slash').addClass('fa-microphone');
                                            }
                                        }
                                    }
                                }

                            } else {
                                $('#p'+index).html('<div class="scene" onclick="set_scene(\''+item.name+'\');"><p>Scene:</p><b>'+item.name+'</b></div><div class="transition" onclick="select_transition(\''+item.name+'\')"><p>OUT transition:</p><b>'+current_scene_transition+'</b></div>');
                                $('#p'+index).addClass("standby");
                            }
                        });
                        console.log('Scenes load and initialization complete.');
                        con_save_config('transition_per_scene', con_scenes_transitions);
                    } else {
                        console.log('Scenes list not found.');
                    }
                    
                break;
                case 'GetSpecialSources':
                    if ( data ) {
                        console.log( "Get all special sources used in OBS." );
                        var special_source_id = 0;
                        for ( var source_id in data ) {
                            if ( source_id.indexOf("mic") >= 0 ) {
                                obs_audio[data[source_id]] = { 'mute': true, 'con_id': '#special'+special_source_id, 'type': 'microphone' };
                                special_source_id++;
                            } else if ( source_id.indexOf("desktop") >= 0 ) {
                                obs_audio[data[source_id]] = { 'mute': true, 'con_id': '#special'+special_source_id, 'type': 'desktop-audio' };
                                special_source_id++;
                            }
                        }
                    }
                break;
                case 'GetSourcesList':
                    if ( data['sources'] ) {
                        console.log( "Get all sources used in current Scene Collection." );
                        for ( var source_id in data['sources'] ) {
                            if ( data['sources'][source_id]['type'] == 'input' && data['sources'][source_id]['typeId'] == 'wasapi_input_capture' ) {
                                obs_sources[data['sources'][source_id]['name']]          = 'obs_audio';
                                if ( data['sources'][source_id]['name'].indexOf("MO:") >= 0 ) {
                                    console.log( "Main OUT audio source found." );
                                    con_main_out_audio_source                            = data['sources'][source_id]['name'];
                                    obs_audio[data['sources'][source_id]['name']]        = { 'mute': false, 'con_id': '#global-sound-on-off', 'type': 'main-out' };
                                } else if ( data['sources'][source_id]['name'].indexOf("MI:") >= 0 ) {
                                    console.log( "Main IN audio source found." );
                                    con_main_in_audio_source                             = data['sources'][source_id]['name'];
                                    obs_audio[data['sources'][source_id]['name']]        = { 'mute': false, 'con_id': '#microphone-on-off', 'type': 'main-in' };
                                } else {
                                    obs_audio[data['sources'][source_id]['name']]        = { 'mute': false, 'con_id': '#audio'+source_id, 'type': 'default' };    
                                }
                            }
                            if ( data['sources'][source_id]['type'] == 'input' && data['sources'][source_id]['typeId'] == 'dshow_input' ) {
                                obs_sources[data['sources'][source_id]['name']]          = 'obs_cameras';
                                obs_cameras[data['sources'][source_id]['name']]          = { 'con_id': '#camera'+source_id };
                            }
                            if ( data['sources'][source_id]['type'] == 'input' && data['sources'][source_id]['typeId'] == 'image_source' ) {
                                obs_sources[data['sources'][source_id]['name']]          = 'obs_images';
                                obs_images[data['sources'][source_id]['name']]           = { 'con_id': '#image'+source_id };
                            }
                            if ( data['sources'][source_id]['type'] == 'input' && data['sources'][source_id]['typeId'] == 'browser_source' ) {
                                obs_sources[data['sources'][source_id]['name']]          = 'obs_browsers';
                                obs_browsers[data['sources'][source_id]['name']]         = { 'url': '', 'con_id': '#browser'+source_id };
                            }
                            if ( data['sources'][source_id]['type'] == 'input' && data['sources'][source_id]['typeId'] == 'monitor_capture' ) {
                                obs_sources[data['sources'][source_id]['name']]          = 'obs_monitors_capture';
                                obs_monitors_capture[data['sources'][source_id]['name']] = { 'con_id': '#monitorcapture'+source_id };
                            }
                            if ( data['sources'][source_id]['type'] == 'input' && data['sources'][source_id]['typeId'] == 'game_capture' ) {
                                obs_sources[data['sources'][source_id]['name']]          = 'obs_games_capture';
                                obs_games_capture[data['sources'][source_id]['name']]    = { 'con_id': '#gamecapture'+source_id };
                            }
                        }

                        // Process GetMuted for Audio source
                        for ( var obs_audio_source_name in obs_audio ) {
                            obs_request( "GetMute", { "source" : obs_audio_source_name } );
                        }
                        //console.log( data );
                    }
                break;
                case 'GetMute':
                    if ( data['name'] in obs_audio ) {
                        if ( data['muted'] == true ) {
                            obs_audio[data['name']]['mute'] = true;
                        } else {
                            obs_audio[data['name']]['mute'] = false;
                        }
                        if ( $('div').is(obs_audio[data['name']]['con_id']) ) {
                            if ( obs_audio[data['name']]['mute'] ) {
                                switch (data['name']) {
                                    case con_main_out_audio_source:
                                        $(obs_audio[data['name']]['con_id'] + '> i' ).removeClass('fa-volume-up').addClass('fa-volume-mute');
                                        $(obs_audio[data['name']]['con_id']).addClass('muted');
                                    break;
                                    case con_main_in_audio_source:
                                        $(obs_audio[data['name']]['con_id'] + '> i' ).removeClass('fa-microphone').addClass('fa-microphone-slash');
                                        $(obs_audio[data['name']]['con_id']).addClass('muted');
                                    break;
                                    default:
                                        if ( $(obs_audio[data['name']]['con_id'] + '> i').hasClass('fa-volume-up') ) {
                                            $(obs_audio[data['name']]['con_id'] + '> i').removeClass('fa-volume-up').addClass('fa-volume-mute');
                                        } else if ( $(obs_audio[data['name']]['con_id'] + '> i').hasClass('fa-microphone') ) {
                                            $(obs_audio[data['name']]['con_id'] + '> i').removeClass('fa-microphone').addClass('fa-microphone-slash');
                                        }
                                        $(obs_audio[data['name']]['con_id']).addClass('muted');
                                }
                            } else {
                                switch (data['name']) {
                                    case con_main_out_audio_source:
                                        $(obs_audio[data['name']]['con_id'] + '> i' ).removeClass('fa-volume-mute').addClass('fa-volume-up');
                                        $(obs_audio[data['name']]['con_id']).removeClass('muted');
                                    break;
                                    case con_main_in_audio_source:
                                        $(obs_audio[data['name']]['con_id'] + '> i' ).removeClass('fa-microphone-slash').addClass('fa-microphone');
                                        $(obs_audio[data['name']]['con_id']).removeClass('muted');
                                    break;
                                    default:
                                        if ( $(obs_audio[data['name']]['con_id'] + '> i').hasClass('fa-volume-mute') ) {
                                            $(obs_audio[data['name']]['con_id'] + '> i').removeClass('fa-volume-mute').addClass('fa-volume-up');
                                        } else if ( $(obs_audio[data['name']]['con_id'] + '> i').hasClass('fa-microphone-slash') ) {
                                            $(obs_audio[data['name']]['con_id'] + '> i').removeClass('fa-microphone-slash').addClass('fa-microphone');
                                        }
                                        $(obs_audio[data['name']]['con_id']).removeClass('muted');
                                }
                            }
                        } 
                    }
                break;
                
                case 'GetStreamingStatus':
                    console.log( "Command:" + command );
                    //console.log( data );
                break;
               
                case 'GetTransitionList':
                    if ( 'current-transition' in data ) {
                        obs_current_transition = data['current-transition'];
                        console.log( 'Current transition: ' + obs_current_transition );
                    }
                    if ( 'transitions' in data ) {
                        obs_transition_list = {};
                        data.transitions.forEach( function( item, index, sub_array ){
                            obs_transition_list[item.name] = true;
                        } );
                        console.log('Transition list loaded and ready to use.');
                    }
                break;
                case 'GetTransitionDuration':
                    if ( 'transition-duration' in data ) {
                        obs_current_transition_duration = data['transition-duration'];
                        console.log( 'Current transition duration: ' + obs_current_transition_duration + ' ms' );
                    }
                break;
                
                case 'SetCurrentScene':
                    console.log("Scene switched.");
                break;

                case 'GetBrowserSourceProperties':
                    // For refresh page only.
                    if ( 'url' in data && 'source' in data ) {
                        let browser_source_url          = new URL(data.url);
                        let browser_source_url_params   = new URLSearchParams(browser_source_url.search);
                        browser_source_url_params.set('con_refresh', Math.random().toString(36).substring(7));
                        obs_request( 'SetBrowserSourceProperties', { 'source': data.source, 'url': browser_source_url.origin + browser_source_url.pathname + '?' + browser_source_url_params.toString() } );
                    }
                break;
                
                case 'SetBrowserSourceProperties':
                    if ( data.status == 'ok' ) {
                        $('div.browser-request').removeClass('browser-request');
                    } else {
                        $('div.browser-request').removeClass('browser-request').addClass('browser-error');
                    }
                break;

                default:
                    console.log( '[DEBUG_COMMAND] Command: ' + command );
                    //console.log( data );
            }
        }

        function set_scene( to_scene_name ) {
            if ( !con_scene_buttons_lock ) {
                if ( con_scenes_transitions[obs_current_scene] in obs_transition_list ) {
                    console.log( "Transition exists in OBS TransitionList." );
                } else {
                    console.log( "Transition not exists in OBS TransitionList. Switching to 'Fade' transition." );
                    con_scenes_transitions[obs_current_scene] = 'Fade';
                    con_save_config('transition_per_scene', con_scenes_transitions);
                }
                obs_request( "SetCurrentTransition", { "transition-name" : con_scenes_transitions[obs_current_scene] } );
                if ( con_scenes_transitions[obs_current_scene] != 'Cut' ) {
                    //obs_request( "SetTransitionDuration", { "duration" : current_transition_duration } );
                    console.log( "Change transition duration." );
                }            
                console.log( "Transition changed. Start switching scene." );
                obs_request( "SetCurrentScene", { "scene-name" : to_scene_name } );
            }
        }

        function set_stream_start_stop() {
            if ( obs_streaming ) {
                obs_request( "StopStreaming", {} );
                $("#stream-start-stop").removeClass().addClass("wait");
            } else {
                obs_request( "StartStreaming", {} );
                $("#stream-start-stop").removeClass().addClass("wait");
            }
        }

        function set_record_start_stop() {
            if ( obs_recording ) {
                obs_request( "StopRecording", {} );
                $("#record-start-stop").removeClass().addClass("wait");
            } else {
                obs_request( "StartRecording", {} );
                $("#record-start-stop").removeClass().addClass("wait");
            }         
        }
        
        function set_audio_mute_unmute( audio_source ) {
            switch ( audio_source ) {
                case 'main-microphone':
                    audio_source = con_main_in_audio_source;
                break;
                case 'main-sound':
                    audio_source = con_main_out_audio_source;
                break;
            }
            if (  audio_source != '' &&  audio_source in obs_audio ) {
                if ( obs_audio[audio_source]['mute']) {
                    obs_request( "SetMute", { "source" : audio_source, "mute" : false } );
                } else {
                    obs_request( "SetMute", { "source" : audio_source, "mute" : true } );
                }
                obs_request( "GetMute", { "source" : audio_source } );
            }
        }

        function set_camera_on_off( camera_source ) {
            if ( camera_source != '' && camera_source in obs_cameras ) {
                if ( obs_cameras[camera_source]['render'] ) {
                    obs_request( 'SetSceneItemProperties', { 'item': camera_source, 'visible' : false } );
                } else {
                    obs_request( 'SetSceneItemProperties', { 'item': camera_source, 'visible' : true } );
                }
            }
        }

        function refresh_web_source( browser_source ) {
            if ( browser_source != '' && browser_source in obs_browsers ) {
                $(obs_browsers[browser_source]['con_id']).addClass('browser-request');
                obs_request( 'GetBrowserSourceProperties', { 'source': browser_source } );
            }
        }

        function panel_init() {
            // Save client credentials
            con_save_config('client_credentials', con_client_credentials);
            
            //Client data initialization + UI initialization.
            $("#client-connection").hide();
            $("#status").removeClass("shutdown").addClass("ready");
            $("#control").removeClass().addClass("online");

            obs_request( "GetSourcesList" );
            obs_request( "GetSpecialSources" );
            obs_request( "GetTransitionList" );
            obs_request( "GetTransitionDuration" );
            obs_request( "GetSceneList" );
            obs_request( "GetStreamingStatus" );
        }

        function con_load_config( structure_name ) {
            var loaded_data = localStorage.getItem(structure_name);
            if ( loaded_data !== null ) {
                return JSON.parse(loaded_data);
            } else {
                return {};
            }
        }

        function con_save_config( structure_name, structure_data ) {
            localStorage.setItem( structure_name, JSON.stringify(structure_data) );
            return true;
        }

        function select_transition( scene_id ) {
            
            //console.log( scene_id );
            //console.log( obs_transition_list );
            
            $('.transition-selection > h1').html( "Choose <b>OUT</b> transition for '<b>"+scene_id+"</b>':" );
            if ( con_scenes_transitions ) {
                var current_transition = con_scenes_transitions[scene_id]
            } else {
                var current_transition = obs_current_transition;
            }

            var button_id       = 1;
            var buttons_set     = {};
            var button_selected = '';
            var button_html     = '';

            for ( var transitions_name in obs_transition_list ) {
                if ( current_transition == transitions_name ) {
                    button_selected = 'tr' + button_id;
                }
                buttons_set['tr'+button_id] = transitions_name;
                button_id++;
            }
            if ( button_id <= 10 ) {
                while ( button_id <= 10 ) {
                    buttons_set['tr'+button_id] = 'disable';
                    button_id++;
                }
            }

            if ( button_id != 0 ) {
                button_id = 10;
            }

            for ( var button_set_id in buttons_set ) {
                
                if ( button_id > 0 ) {
                    //console.log(button_set_id);
                    //console.log(button_selected);
                    if ( button_set_id == button_selected ) {
                        button_html = '<div id="'+button_set_id+'" class="transition current" onclick="selecting_transition(\''+button_set_id+'\', \''+button_selected+'\', \''+buttons_set[button_set_id]+'\', \''+scene_id+'\')"><h2>'+buttons_set[button_set_id]+'</h2><h4>Duration: 300 ms</h4><h6>OBS default transition.</h6></div>';
                    } else if ( buttons_set[button_set_id] != 'disable' ) {
                        button_html = '<div id="'+button_set_id+'" class="transition" onclick="selecting_transition(\''+button_set_id+'\', \''+button_selected+'\', \''+buttons_set[button_set_id]+'\', \''+scene_id+'\')"><h2>'+buttons_set[button_set_id]+'</h2><h4>Duration: 300 ms</h4><h6>OBS default transition.</h6></div>';
                    } else {
                        button_html = '<div id="'+button_set_id+'" class="transition disable"></div>';
                    }
                    $('#transitions-list').append(button_html);
                    button_id--;
                }

            }

            $('#transition-select').show( 'fade', 200, function(){
                console.log('Showing selecting transition complete.');
            });
        }

        function selecting_transition ( choosed_transition, current_transition, transition_id, scene_id ) {
            
            console.log('Closing selecting transition start.');
            //console.log(choosed_transition);
            //console.log(current_transition);
            //console.log(transition_id);
            //console.log(scene_id);

            if ( choosed_transition != current_transition && current_transition ) {
                $('#'+current_transition).removeClass('current');
            }

            $('#'+choosed_transition).effect( 'pulsate', { times : 2 }, 100, function(){
                $('#'+choosed_transition).addClass('current');
                $('#transition-select').delay(100).hide( 'fade', 200, function(){
                    $('#transitions-list').html('');
                    con_scenes_transitions[scene_id] = transition_id;
                    con_save_config('transition_per_scene', con_scenes_transitions);
                    obs_request( "GetSceneList" );
                    console.log('Closing electing transition complete.');
                });
            });
        }
