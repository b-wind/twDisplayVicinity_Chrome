( function ( w, d ) {

// https://developer.chrome.com/extensions/runtime#event-onMessage
chrome.runtime.onMessage.addListener( function ( message, sender, sendResponse ) {
    var type = message.type,
        response = null;
    
    switch ( type ) {
        case 'GET_OPTIONS':
            var names = message.names,
                namespace = message.namespace;
            
            response = {};
            
            if ( typeof name_list == 'string' ) {
                names = [ names ];
            }
            
            Array.apply( null, names ).forEach( function( name ) {
                name = String( name );
                response[ name ] = localStorage[ ( ( namespace ) ? ( String( namespace ) + '_' ) : '' ) + name ];
            } );
            break;
        
        default:
            break;
    }
    
    sendResponse( response );
} );

chrome.runtime.onConnect.addListener( function ( port ) {
    if ( port.name == 'open_in_tab' ) {
        port.onMessage.addListener( function ( message, con ) {
            chrome.tabs.create( {
                url : message.url
            ,   selected : ( message.selected ) ? true : false
            } );
        } );
    }
} );

} )( window, document );

// ■ end of file
