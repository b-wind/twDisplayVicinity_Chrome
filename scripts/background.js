( function ( w, d ) {

'use strict';

w.chrome = ( ( typeof browser != 'undefined' ) && browser.runtime ) ? browser : chrome;


// メッセージ待ち受け
// https://developer.chrome.com/extensions/runtime#event-onMessage
chrome.runtime.onMessage.addListener( function ( message, sender, sendResponse ) {
    var type = message.type,
        response = null;
    
    if ( ( sender.id != chrome.runtime.id ) || ( ! sender.tab ) || ( ! sender.tab.id ) ) {
        sendResponse( response );
        return;
    }
    
    switch ( type ) {
        case 'GET_OPTIONS' :
            ( ( names, namespace ) => {
                response = {};
                
                if ( typeof name_list == 'string' ) {
                    names = [ names ];
                }
                
                Array.apply( null, names ).forEach( function( name ) {
                    name = String( name );
                    response[ name ] = localStorage[ ( ( namespace ) ? ( String( namespace ) + '_' ) : '' ) + name ];
                } );
            } )( message.names, message.namespace );
            break;
        
        default:
            break;
    }
    
    sendResponse( response );
    
    return true;
} );


// WebRequest

// HTTP Request ヘッダの取得＆書換
// ※有効にする場合は、 manifest.json に
//   "permissions": [ "webRequest", "webRequestBlocking", "*://*.twitter.com/*" ]
//   を追加すること。
//   またあわせて、"background" の "persistent" は true にすること
//   （false のままだと、manifest.json 読み込み時に、"The 'webRequest' API cannot be used with event pages." エラーが出る）
// ※ [Cookie 変更時には、'extraHeaders' が必要（Chrome>=72）](https://twitter.com/furyutei/status/1102718008919646209)

var reg_oauth2_token_url = /^https:\/\/api\.twitter\.com\/oauth2\/token/,
    reg_legacy_mark_url = /[?&]__twdv=legacy(?:&|$)/;

chrome.webRequest.onBeforeSendHeaders.addListener(
    function ( details ) {
        var requestHeaders,
            url = details.url;
        
        if ( reg_oauth2_token_url.test( url ) ) {
            // ※ OAuth2 の token 取得時(api.twitter.com/oauth2/token)に Cookie を送信しないようにする
            requestHeaders = details.requestHeaders.filter( function ( element, index, array ) {
                return ( element.name.toLowerCase() != 'cookie' );
            } );
        }
        else if ( reg_legacy_mark_url.test( url ) ) {
            // ※ "__twdv=legacy" が付いている場合、旧 Twitter の HTML / API をコールするために User-Agent を変更
            requestHeaders = details.requestHeaders.map( function ( element ) {
                if ( element.name.toLowerCase() == 'user-agent' ) {
                    //element.value = 'Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko';
                    element.value = 'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; AS; rv:11.0) Waterfox/56.2';
                    // 参考：[ZusorCode/GoodTwitter](https://github.com/ZusorCode/GoodTwitter)
                }
                return element;
            } );
        }
        
        return ( ( requestHeaders !== undefined ) ? { requestHeaders : requestHeaders } : {} );
    },
    { urls : [ '*://*.twitter.com/*' ] },
    [ 'blocking', 'requestHeaders', 'extraHeaders' ]
);

} )( window, document );

// ■ end of file
