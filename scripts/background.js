( function ( w, d ) {

'use strict';

w.chrome = ( ( typeof browser != 'undefined' ) && browser.runtime ) ? browser : chrome;


// https://developer.chrome.com/extensions/runtime#event-onMessage
chrome.runtime.onMessage.addListener( function ( message, sender, sendResponse ) {
    var type = message.type,
        response = null;
    
    if ( ( sender.id != chrome.runtime.id ) || ( ! sender.tab ) || ( ! sender.tab.id ) ) {
        sendResponse( response );
        return;
    }
    
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


// WebRequest
// ※ OAuth2 の token 取得時に Cookie を送信しないようにする
// ※有効にする場合は、 manifest.json に
//   "permissions": [ "webRequest", "webRequestBlocking", "*://*.twitter.com/*" ]
//   を追加すること。
//   またあわせて、"background" の "persistent" は true にすること
//   （false のままだと、manifest.json 読み込み時に、"The 'webRequest' API cannot be used with event pages." エラーが出る）
/*
//chrome.webRequest.onBeforeSendHeaders.addListener(
//    function ( details ) {
//        var requestHeaders = details.requestHeaders.filter( function ( element, index, array ) {
//                return ( element.name.toLowerCase() != 'cookie' );
//            } );
//        
//        return { requestHeaders: requestHeaders };
//    },
//    { urls : [ '*://api.twitter.com/oauth2/token' ] },
//    [ 'blocking', 'requestHeaders' ]
//);
*/

} )( window, document );

// ■ end of file
