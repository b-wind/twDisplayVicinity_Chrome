( function ( w, d ) {

'use strict';

w.chrome = ( ( typeof browser != 'undefined' ) && browser.runtime ) ? browser : chrome;


function get_bool( value ) {
    if ( value === undefined ) {
        return null;
    }
    if ( ( value === '0' ) || ( value === 0 ) || ( value === false ) || ( value === 'false' ) ) {
        return false;
    }
    if ( ( value === '1' ) || ( value === 1 ) || ( value === true ) || ( value === 'true' ) ) {
        return true;
    }
    return null;
}  // end of get_bool()


function get_int( value ) {
    if ( isNaN( value ) ) {
        return null;
    }
    return parseInt( value, 10 );
} // end of get_int()


function get_text( value ) {
    if ( value === undefined ) {
        return null;
    }
    return String( value );
} // end of get_text()


function get_init_function( message_type, option_name_to_function_map, namespace ) {
    var option_names = [];
    
    for ( var option_name in option_name_to_function_map ) {
        if ( option_name_to_function_map.hasOwnProperty( option_name ) ) {
            option_names.push( option_name );
        }
    }
    
    function analyze_response( response ) {
        var options = {};
        
        if ( ! response ) {
            response = {};
        }
        
        for ( var option_name in option_name_to_function_map ) {
            if ( ! ( response.hasOwnProperty( option_name ) ) ) {
                options[ option_name ] = null;
                continue;
            }
            options[ option_name ] =  option_name_to_function_map[ option_name ]( response[ option_name ] );
        }
        return options;
    }
    
    function init( callback ) {
        // https://developer.chrome.com/extensions/runtime#method-sendMessage
        chrome.runtime.sendMessage( {
            type : message_type
        ,   names : option_names
        ,   namespace :  ( namespace ) ? namespace : ''
        }, function ( response ) {
            var options = analyze_response( response );
            callback( options );
        } );
    }
    
    return init;
} // end of get_init_function()


var twDisplayVicinity_chrome_init = ( function() {
    var option_name_to_function_map = {
            OPERATION : get_bool
        ,   USE_SEARCH_TL_BY_DEFAULT : get_bool
        ,   HIDE_NEWER_TWEETS : get_bool
        ,   USE_LINK_ICON : get_bool
        ,   IGNORE_SINCE : get_bool
        ,   ENABLE_RECENT_RETWEET_USERS_BUTTON : get_bool
        ,   CACHE_OAUTH2_ACCESS_TOKEN : get_bool
        
        ,   HOUR_BEFORE : get_int
        ,   HOUR_AFTER : get_int
        ,   DAY_BEFORE : get_int
        ,   DAY_AFTER : get_int
        ,   MAX_USER_NUMBER : get_int
        ,   MAX_AFTER_RETWEET_MINUTES : get_int
        ,   MAX_BEFORE_RETWEET_MINUTES : get_int
        
        ,   TARGET_TWEET_COLOR : get_text
        ,   TARGET_TWEET_COLOR_NIGHTMODE : get_text
        ,   VICINITY_TWEET_COLOR : get_text
        ,   VICINITY_TWEET_COLOR_NIGHTMODE : get_text
        ,   LINK_COLOR : get_text
        ,   ACT_LINK_COLOR : get_text
        ,   LINK_TEXT : get_text
        ,   LINK_TITLE : get_text
        ,   ACT_LINK_TEXT : get_text
        ,   ACT_LINK_TITLE : get_text
        ,   GO_TO_PAST_TEXT : get_text
        };
    
    return get_init_function( 'GET_OPTIONS', option_name_to_function_map );
} )(); // end of twDisplayVicinity_chrome_init()


if ( ( typeof content != 'undefined' ) && ( typeof content.XMLHttpRequest == 'function' ) ) {
    jQuery.ajaxSettings.xhr = function () {
        try {
            return new content.XMLHttpRequest();
        } catch ( e ) {}
    };
}

w.is_web_extension = true;
w.twDisplayVicinity_chrome_init = twDisplayVicinity_chrome_init;

} )( window, document );

// ■ end of file
