// ==UserScript==
// @name            twDisplayVicinity
// @namespace       http://d.hatena.ne.jp/furyu-tei
// @author          furyu
// @version         0.2.5.1
// @include         https://twitter.com/*
// @require         https://ajax.googleapis.com/ajax/libs/jquery/2.2.4/jquery.min.js
// @require         https://cdnjs.cloudflare.com/ajax/libs/decimal.js/7.3.0/decimal.min.js
// @grant           GM_xmlhttpRequest
// @description     Display the vicinity of a particular tweet on Twitter.
// ==/UserScript==
/*
  [Download (User Script)](https://github.com/furyutei/twDisplayVicinity/raw/master/twDisplayVicinity.user.js)
  [GitHub (User Script)](https://github.com/furyutei/twDisplayVicinity)
  [Download (Chrome Web Store)](https://chrome.google.com/webstore/detail/twdisplayvicinity/anmfeeanmnmdkjlhojpodibignbcfgjm?hl=ja)
  [GitHub (Chrome Extension)](https://github.com/furyutei/twDisplayVicinity_Chrome)
  [Related article](http://furyu.hatenablog.com/entry/20140327/1395914958)
  [Original (Bookmarklet)](http://let.hatelabo.jp/furyu-tei/let/hLHVnMG9q-NH)
*/

/*
■ 外部ライブラリ
- [jQuery](https://jquery.com/)
    The MIT License
    [License | jQuery Foundation](https://jquery.org/license/)

- [MikeMcl/decimal.js: An arbitrary-precision Decimal type for JavaScript](https://github.com/MikeMcl/decimal.js)
    Copyright (c) 2016, 2017 Michael Mclaughlin
    The MIT Licence
    [decimal.js/LICENCE.md](https://github.com/MikeMcl/decimal.js/blob/master/LICENCE.md)

■ 関連記事など
- [【近傍ツイート検索】特定ツイート前後のタイムラインを表示するユーザースクリプト試作 - 風柳メモ](http://furyu.hatenablog.com/entry/20140327/1395914958)
*/

/*
The MIT License (MIT)

Copyright (c) 2014 furyu <furyutei@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

( function ( w, d ) {

'use strict';

//{ ■ パラメータ
var OPTIONS = {
    USE_SEARCH_TL_BY_DEFAULT : false, // true: デフォルトで検索タイムラインを使用
    
    HOUR_BEFORE : 24, // 対象ツイートから遡る期間(時間)
    HOUR_AFTER : 8, // 対象ツイートより後の期間(時間)
    
    // DAY_BEFORE / DAY_AFTER は、検索タイムラインで  until: / since: が "YYYY-MM-DD_hh:mm:ss_GMT" の形で指定できることが判明したので未使用とする
    DAY_BEFORE : 1, // (未使用) 対象ツイートから遡る期間(日)(検索タイムライン用・時間指定時)
    DAY_AFTER : 1, // (未使用) 対象ツイートより後の期間(日)(検索タイムライン用・時間指定時)
    
    IGNORE_SINCE : true, // true: 検索タイムラインのオプションに since: を付けない
    
    TARGET_TWEET_COLOR : 'gold', // 対象ツイートの色
    VICINITY_TWEET_COLOR : 'pink', // 近傍ツイートの色
    LINK_COLOR : 'darkblue', // 近傍リンクの色
    ACT_LINK_COLOR : 'indigo', // 通知リンクの色
    
    HIDE_NEWER_TWEETS : true, // true: 最新のツイート(追加されたもの)を非表示
    USE_LINK_ICON : true, // 近傍リンクの種類（true: アイコンを使用 ／ false: 文字を使用
    
    OPERATION : true // true: 動作中、false: 停止中
};

//}


//{ ■ 共通変数
var SCRIPT_NAME = 'twDisplayVicinity',
    
    DEBUG = false;


//{ check environment
if ( w[ SCRIPT_NAME + '_touched' ] ) {
    return;
}
w[ SCRIPT_NAME + '_touched' ] = true;

if ( w !== w.parent ) {
    return;
}

if ( ( typeof jQuery != 'function' ) || ( typeof Decimal != 'function' ) ) {
    console.error( SCRIPT_NAME + ':', 'Library not found', typeof jQuery, typeof Decimal );
    return;
}

var $ = jQuery,
    
    LANGUAGE = ( function () {
        try {
            return ( w.navigator.browserLanguage || w.navigator.language || w.navigator.userLanguage ).substr( 0, 2 );
        }
        catch ( error ) {
            return 'en';
        }
    } )(),
    
    IS_PAGE_404 = ( function () {
        var jq_form_404 = $( 'form.search-404' );
        
        if ( 0 < jq_form_404.length ) {
            return true;
        }
        return false;
    } )();

//} end of check environment


switch ( LANGUAGE ) {
    case 'ja' :
        OPTIONS.LINK_TEXT = '近傍';
        OPTIONS.LINK_TITLE = '近傍ツイート表示';
        OPTIONS.ACT_LINK_TEXT = '近傍';
        OPTIONS.ACT_LINK_TITLE = 'アクションの近傍ツイート表示';
        break;
    default:
        OPTIONS.LINK_TEXT = 'vicinity';
        OPTIONS.LINK_TITLE = 'search vicinity tweets';
        OPTIONS.ACT_LINK_TEXT = 'vicinity';
        OPTIONS.ACT_LINK_TITLE = 'search vicinity tweets around action';
        break;
}

var SEARCH_API = 'https://twitter.com/search',
    TIMELINE_API_BASE = 'https://twitter.com/',
    
    LINK_CONTAINER_CLASS = SCRIPT_NAME + '_link_container',
    ACT_CONTAINER_CLASS = SCRIPT_NAME + '_act_container',
    
    CONTAINER_CLASS_LIST = [ LINK_CONTAINER_CLASS, ACT_CONTAINER_CLASS ],
    
    INTV_CHECK_MS = 300, // チェック間隔(単位：ms)
    MAX_CHECK_RETRY = 10, // 'div.stream-end' 要素が表示されてから、チェックを終了するまでのリトライ回数(タイミングにより、いったん表示されてもまた消える場合がある)
    WAIT_BEFORE_GIVEUP_SCROLL_SEC = 30, // 強制スクロールさせてタイムラインの続きを読み込む際に、いつまでも変化が見られず、諦めるまでの時間(単位:秒)
    
    ID_INC_PER_MSEC = Decimal.pow( 2, 22 ), // ミリ秒毎のID増分
    ID_INC_PER_SEC = ID_INC_PER_MSEC.mul( 1000 ), // 秒毎のID増分
    TWEPOCH_OFFSET_MSEC = 1288834974657,
    TWEPOCH_OFFSET_SEC = Math.ceil( TWEPOCH_OFFSET_MSEC / 1000 ), // 1288834974.657 sec (2011.11.04 01:42:54(UTC)) (via http://www.slideshare.net/pfi/id-15755280)
    ID_THRESHOLD = '300000000000000', // 2010.11.04 22時(UTC)頃に、IDが 30000000000以下から300000000000000以上に切り替え
    ID_BEFORE = null,
    ID_AFTER = null,
    
    LINK_ICON_URL = [ // アイコン(48×48)
        'data:image/gif;base64,',
        'R0lGODlhYAAwAKECAP+WE6q4wv///////yH5BAEKAAIALAAAAABgADAAQAL+lI+pi+HBopwKWEDz',
        'fLx7p2nXSJZWiDZdyi7l9kEGd8Tg/NSxeRrjwesJfj4ejNZKFonKjM3WZASD0ariebNGpkKtxOMN',
        'vcLOFZkyToLPkzQbhzWHuaY3/GNPTPPWGF9fxxeHdEbH5DWI52UYaLf2h+AGKfA4OURy5JcQd3dj',
        'w1UBekkUBEVpxrn5RDV6scQaufclZykJWTlpS5aIG8WoW5WYxzjZ+wdsGWLMh8z2lAvrODhs+Mab',
        'Q/brGnZNaKV92NddCP63TB1+Swudbr4O2Wz9fow52/18ivQJLjpWanoF35p9RlzI8sfD1EB8AXcU',
        'RBgtVkJNC+8RhLiNn6gyCOfsxHM2j1m9ZB3ffDxTks3JJhZlaNGIAZHFORpR8jL5K08qdBGlpaS5',
        'khu2ZK/eFAAAOw=='
    ].join( '' ),
    
    SELECTOR_INFO = ( function () {
        var SELECTOR_INFO = {},
            container_selector_list = SELECTOR_INFO.container_selector_list = [
                'div.GridTimeline-items',
                'ol.stream-items',
                'ol.recent-tweets',
                'div.permalink-tweet-container',
                'div.GalleryTweet'
            ],
            tweet_class_names = SELECTOR_INFO.tweet_class_names = [ 'js-stream-tweet', 'tweet', 'js-tweet' ],
            simple_tweet_selector = SELECTOR_INFO.simple_tweet_selector = tweet_class_names.map( function ( class_name ) {
                return 'div.' + class_name;
            } ).join( ',' ),
            container_selector = SELECTOR_INFO.container_selector = container_selector_list.join( ',' ),
            tweet_selector_list = SELECTOR_INFO.tweet_selector_list = [],
            activity_class_names = SELECTOR_INFO.activity_class_names = [ 'stream-item-activity-notification' ],
            activity_selector = SELECTOR_INFO.activity_selector = activity_class_names.map( function ( class_name ) {
                return 'div.' + class_name + '[data-activity-type]';
            } ).join( ',' ),
            tweet_wrapper_selector = SELECTOR_INFO.tweet_wrapper_selector = 'div.StreamItem:first,div.Grid:first,li:first';
       
        container_selector_list.forEach( function ( container_selector_item ) {
            tweet_class_names.forEach( function ( tweet_class_name ) {
                tweet_selector_list.push( container_selector_item + ' div.' + tweet_class_name );
            } );
        } );
        
        SELECTOR_INFO.tweet_selector = tweet_selector_list.join( ',' );
        
        return SELECTOR_INFO;
    } )(),
    
    SEARCH_PARAMETERS = ( function () {
        var search_parameters = {},
            current_url = w.location.href,
            comparison_url  = current_url.replace( /&_replaced=1/, '' ), // ユーザータイムライン→検索タイムラインの切替時につけているマーク
            is_replaced = ( comparison_url != current_url );
        
        if ( ! w.opener ) {
            return {};
        }
        
        try {
            search_parameters = JSON.parse( w.name );
            
            if ( ! search_parameters ) {
                return {};
            }
            
            var is_matched = search_parameters.search_url_list.some( function ( search_url ) {
                    return ( search_url == comparison_url );
                } );
            
            if ( ! is_matched ) {
                return {};
            }
        }
        catch ( error ) {
            return {};
        }
        
        search_parameters.initial_search_url = current_url;
        
        //w.name = ''; // 誤動作しないようにクリアしようとしたが、出来ない
        //  "Execution of script 'twDisplayVicinity' failed! Cannot set property name of #<Object> which has only a getter" ( by Tampermonkey )
        
        return search_parameters;
    } )();

//} end of global variables


// ■ 関数

function to_array( array_like_object ) {
    return Array.prototype.slice.call( array_like_object );
} // end of to_array()


function log_debug() {
    if ( ! DEBUG ) {
        return;
    }
    var arg_list = [ '[' + SCRIPT_NAME + ']', '(' + ( new Date().toISOString() ) + ')' ];
    
    console.log.apply( console, arg_list.concat( to_array( arguments ) ) );
} // end of log_debug()


function log_error() {
    var arg_list = [ '[' + SCRIPT_NAME + ']', '(' + ( new Date().toISOString() ) + ')' ];
    
    console.error.apply( console, arg_list.concat( to_array( arguments ) ) );
} // end of log_error()


// 参考: [複数のクラス名の存在を確認（判定） | jQuery逆引き | Webサイト制作支援 | ShanaBrian Website](http://shanabrian.com/web/jquery/has-classes.php)
$.fn.hasClasses = function( selector, or_flag ) {
    var self = this,
        class_names,
        counter = 0;
    
    if ( typeof selector === 'string' ) {
        selector = selector.trim();
        class_names = ( selector.match( /^\./ ) ) ? selector.replace( /^\./, '' ).split( '.' ) : selector.split( ' ' )
    }
    else {
        class_names = selector;
    }
    class_names.forEach( function( class_name ) {
        if ( self.hasClass( class_name ) ) {
            counter ++;
        }
    } );
    
    if ( or_flag && 0 < counter ) {
        return true;
    }
    if ( counter === class_names.length ) {
        return true;
    }
    return false;
}; // end of $.fn.hasClasses()


// 参考: [日付フォーマットなど 日付系処理 - Qiita](http://qiita.com/osakanafish/items/c64fe8a34e7221e811d0)
function format_date( date, format, flag_utc ) {
    if ( ! format ) {
        format = 'YYYY-MM-DD hh:mm:ss.SSS';
    }
    
    var msec = ( '00' + ( ( flag_utc ) ? date.getUTCMilliseconds() : date.getMilliseconds() ) ).slice( -3 ),
        msec_index = 0;
    
    if ( flag_utc ) {
        format = format
            .replace( /YYYY/g, date.getUTCFullYear() )
            .replace( /MM/g, ( '0' + ( 1 + date.getUTCMonth() ) ).slice( -2 ) )
            .replace( /DD/g, ( '0' + date.getUTCDate() ).slice( -2 ) )
            .replace( /hh/g, ( '0' + date.getUTCHours() ).slice( -2 ) )
            .replace( /mm/g, ( '0' + date.getUTCMinutes() ).slice( -2 ) )
            .replace( /ss/g, ( '0' + date.getUTCSeconds() ).slice( -2 ) )
            .replace( /S/g, function ( all ) { return msec.charAt( msec_index ++ ) } );
    }
    else {
        format = format
            .replace( /YYYY/g, date.getFullYear() )
            .replace( /MM/g, ( '0' + ( 1 + date.getMonth() ) ).slice( -2 ) )
            .replace( /DD/g, ( '0' + date.getDate() ).slice( -2 ) )
            .replace( /hh/g, ( '0' + date.getHours() ).slice( -2 ) )
            .replace( /mm/g, ( '0' + date.getMinutes() ).slice( -2 ) )
            .replace( /ss/g, ( '0' + date.getSeconds() ).slice( -2 ) )
            .replace( /S/g, function ( all ) { return msec.charAt( msec_index ++ ) } );
    }
    
    return format;
} // end of format_date()


function bignum_cmp( bignum_left, bignum_right ) {
    return new Decimal( bignum_left ).cmp( bignum_right );
} // end of bignum_cmp()


// Twitter のツイートID は 64 ビットで、以下のような構成をとっている
//   [63:63]( 1) 0(固定)
//   [62:22](41) timestamp: 現在の Unix Time(ms) から、1288834974657(ms) (2011/11/04 01:42:54 UTC) を引いたもの
//   [21:12](10) machine id: 生成器に割り当てられたID。datacenter id + worker id
//   [11: 0](12) 生成器ごとに採番するsequence番号
//
// 参考:
//   [Twitterのsnowflakeについて](https://www.slideshare.net/moaikids/20130901-snowflake)
//   [ツイートID生成とツイッターリアルタイム検索システムの話](https://www.slideshare.net/pfi/id-15755280)
function tweet_id_to_date( tweet_id ) {
    var bignum_tweet_id = new Decimal( tweet_id );
    
    if ( bignum_tweet_id.cmp( ID_THRESHOLD ) < 0 ) {
        // ツイートID仕様の切替(2010/11/04 22時 UTC頃)以前のものは未サポート
        return null;
    }
    return new Date( parseInt( bignum_tweet_id.div( ID_INC_PER_MSEC ).floor().add( TWEPOCH_OFFSET_MSEC ), 10 ) );
} // end of tweet_id_to_date()


function datetime_to_tweet_id( datetime ) {
    try {
        var date = new Date( datetime ),
            utc_ms = date.getTime();
        
        if ( isNaN( utc_ms ) ) {
            return null;
        }
        
        var tweet_timestamp = Decimal.sub( utc_ms, TWEPOCH_OFFSET_MSEC );
        
        if ( tweet_timestamp.cmp( 0 ) < 0 ) {
            return null;
        }
        
        var bignum_tweet_id = tweet_timestamp.mul( ID_INC_PER_MSEC );
        
        if ( bignum_tweet_id.cmp( ID_THRESHOLD ) < 0 ) {
            // ツイートID仕様の切替(2010/11/04 22時 UTC頃)以前のものは未サポート
            return null;
        }
        return bignum_tweet_id.toString();
    }
    catch ( error ) {
        return null;
    }
} // end of datetime_to_tweet_id()


function get_gmt_date( time_sec ) {
    var date = new Date( 1000 * time_sec );
    
    return format_date( date, 'YYYY-MM-DD', true )
} // end of get_gmt_date()


function get_gmt_datetime( time_sec ) {
    var date = new Date( 1000 * time_sec );
    
    return format_date( date, 'YYYY-MM-DD_hh:mm:ss_GMT', true )
} // end of get_gmt_datetime()


function get_gmt_datetime_from_tweet_id( tweet_id, offset_sec ) {
    var tweet_date = tweet_id_to_date( tweet_id );
    
    if ( ! tweet_date ) {
        return null;
    }
    
    var tweet_date_shift = new Date( tweet_date.getTime() + ( ( offset_sec ) ? ( 1000 * offset_sec ) : 0 ) );
    
    return format_date( tweet_date_shift, 'YYYY-MM-DD_hh:mm:ss_GMT', true );
} // end of get_gmt_datetime_from_tweet_id()


function get_tweet_id_from_utc_sec( utc_sec ) {
    if ( utc_sec < TWEPOCH_OFFSET_SEC ) {
        return null;
    }
    var twepoc_sec = Decimal.sub( utc_sec, TWEPOCH_OFFSET_SEC );
    
    return Decimal.mul( ID_INC_PER_SEC, twepoc_sec ).toString();
} // end of get_tweet_id_from_utc_sec()


function get_tweet_id_range( search_tweet_id, search_time_sec, reacted_tweet_id ) {
    if ( ( ! ID_BEFORE ) || ( ! ID_AFTER ) || ( ( ! search_tweet_id ) && ( ! search_time_sec ) ) ) {
        return null;
    }
    
    if ( ! search_tweet_id ) {
        search_tweet_id = get_tweet_id_from_utc_sec( search_time_sec );
        
        if ( ! search_tweet_id ) {
            return null;
        }
    }
    
    var current_id = new Decimal( search_tweet_id ),
        since_id = current_id.sub( ID_BEFORE ),
        max_id = current_id.add( ID_AFTER );
    
    if ( ( reacted_tweet_id ) && ( bignum_cmp( since_id, reacted_tweet_id ) < 0 ) ) {
        since_id = new Decimal( reacted_tweet_id );
    }
    
    log_debug( 'since_id:', since_id.toString(), ' current_id:', current_id.toString(), ' max_id:', max_id.toString() );
    
    if ( since_id.cmp( ID_THRESHOLD ) < 0 ) {
        return null;
    }
    
    var tweet_id_range = {
        current_id : current_id.toString(),
        since_id : since_id.toString(),
        max_id: max_id.toString()
    };
    
    return tweet_id_range;
} // end of get_tweet_id_range()


function parse_individual_tweet_url( tweet_url ) {
    if ( ! tweet_url ) {
        tweet_url = w.location.href;
    }
    
    if ( ! tweet_url.match( /^(?:https?:\/\/[^\/]+)?\/([^\/]+)\/status(?:es)?\/(\d+)/ ) ) {
        return null;
    }
    
    return {
        screen_name : RegExp.$1,
        tweet_id : RegExp.$2
    };
} // end of parse_individual_tweet_url()


function get_search_info( parameters ) {
    var parameters = ( parameters ) ? parameters : {},
        screen_name = parameters.screen_name,
        search_tweet_id = parameters.search_tweet_id,
        reacted_tweet_id = parameters.reacted_tweet_id,
        tweet_id_range = parameters.tweet_id_range,
        search_time_sec = parameters.search_time_sec,
        search_time_range = parameters.search_time_range,
        since_id,
        max_id = parameters.max_id,
        since,
        until,
        query = null,
        search_url_list = [];
    
    if ( tweet_id_range ) {
        search_tweet_id = tweet_id_range.current_id;
    }
    else {
        tweet_id_range = get_tweet_id_range( search_tweet_id, search_time_sec, reacted_tweet_id );
    }
    
    if ( tweet_id_range ) {
        since_id = tweet_id_range.since_id;
        max_id = tweet_id_range.max_id;
        since = get_gmt_datetime_from_tweet_id( since_id );
        until = get_gmt_datetime_from_tweet_id( max_id, 1 );
        
        search_url_list.push( TIMELINE_API_BASE + screen_name + '/with_replies?max_position=' + max_id );
        // 0.2.3.10: max_id → max_position
        
        if ( OPTIONS.IGNORE_SINCE ) {
            query = 'from:' + screen_name + ' until:' + until;
        }
        else {
            query = 'from:' + screen_name + ' since:' + since + ' until:' + until;
        }
    }
    
    if ( ! query ) {
        if ( search_time_sec ) {
            //since = get_gmt_date( search_time_sec - ( 3600 * 24 * OPTIONS.DAY_BEFORE ) ),
            //until = get_gmt_date( search_time_sec + ( 3600 * 24 * ( 1 + OPTIONS.DAY_AFTER ) ) );
            since = get_gmt_datetime( search_time_sec - ( OPTIONS.HOUR_BEFORE * 3600 ) ),
            until = get_gmt_datetime( search_time_sec + ( ( 1 + OPTIONS.HOUR_AFTER * 3600 ) ) );
            
            if ( OPTIONS.IGNORE_SINCE ) {
                query = 'from:' + screen_name + ' until:' + until;
            }
            else {
                query = 'from:' + screen_name + ' since:' + since + ' until:' + until;
            }
        }
        else if ( max_id ) {
            search_url_list.push( TIMELINE_API_BASE + screen_name + '/with_replies?max_position=' + max_id );
            // 0.2.3.10: max_id → max_position
            
            until = get_gmt_datetime_from_tweet_id( max_id, 1 );
            
            if ( until ) {
                query = 'from:' + screen_name + ' until:' + until;
            }
            else {
                query = 'from:' + screen_name + ' max_id:' + max_id;
            }
        }
        else {
            log_error( '[bug] "max_id" is not specified !' );
            query = 'from:' + screen_name;
        }
    }
    
    query += ' include:nativeretweets';
    
    search_url_list.push( SEARCH_API + '?q=' + encodeURIComponent( query ) + '&f=tweets' );
    //search_url_list.push( SEARCH_API + '?q=' + encodeURIComponent( query ) + '&f=tweets&vertical=default' );
    
    if ( OPTIONS.USE_SEARCH_TL_BY_DEFAULT ) {
        search_url_list.reverse();
    }
    
    return {
        search_url_list : search_url_list,
        search_parameters : {
            screen_name : screen_name,
            search_tweet_id : search_tweet_id,
            reacted_tweet_id : reacted_tweet_id,
            tweet_id_range : tweet_id_range,
            search_time_sec : search_time_sec,
            search_time_range : search_time_range,
            since_id : since_id,
            max_id : max_id,
            since : since,
            until : until,
            query : query,
            search_url_list : search_url_list
        }
    };
} // end of get_search_info()


function is_search_mode() {
    if ( ( ! SEARCH_PARAMETERS ) || ( typeof SEARCH_PARAMETERS.search_tweet_id == 'undefined' ) ) {
         return false;
    }
    
    if ( w.location.href != SEARCH_PARAMETERS.initial_search_url ) {
        return false;
    }
    
    return true;
} // end of is_search_mode()


function get_hide_threshold_tweet_id() {
    if ( ( ! OPTIONS.HIDE_NEWER_TWEETS ) || ( ! is_search_mode() ) ) {
        return 0;
    }
    
    var search_tweet_id = SEARCH_PARAMETERS.search_tweet_id,
        max_id = SEARCH_PARAMETERS.max_id,
        threshold_tweet_id = search_tweet_id || max_id;
    
    if ( ! threshold_tweet_id ) {
        return 0;
    }
    
    if ( ( max_id ) && ( bignum_cmp( threshold_tweet_id, max_id ) < 0 ) ) {
        threshold_tweet_id = max_id;
    }
    
    return threshold_tweet_id;
} // end of get_hide_threshold_tweet_id()


var open_child_window = ( function () {
        var child_window_counter = 0;
        
        return function ( url, options ) {
            if ( ! options ) {
                options = {};
            }
            
            var child_window = options.existing_window,
                name = '';
            
            if ( options.search_parameters ) {
                try {
                    options.search_parameters.child_window_id = '' + ( new Date().getTime() ) + '-' + ( ++ child_window_counter ); // window.name が被らないように細工
                    
                    name = JSON.stringify( options.search_parameters );
                }
                catch ( error ) {
                    log_debug( error );
                }
            }
            
            if ( child_window ) {
                if ( child_window.location.href != url ) {
                    child_window.location.href = url;
                }
                if ( child_window.name != name ) {
                    child_window.name = name;
                }
            }
            else {
                child_window = w.open( url, name );
            }
            
            return child_window;
        };
    } )(); // end of open_child_window()


var click_handler_saver = ( function() {
        function ClickHandlerSaver() {
            var self = this;
            
            self.link_id_prefix = SCRIPT_NAME + '_link_';
            self.link_id_number = 0;
            self.link_dict = [];
        } // end of ClickHandlerSaver()
        
        ClickHandlerSaver.prototype.set_click_handler = function ( jq_link, onclick ) {
            var self = this,
                link_id = ( self.link_id_prefix ) + ( self.link_id_number ++ );
            
            jq_link.attr( 'id', link_id );
            self.link_dict[ link_id ] = onclick;
            
            jq_link
            .unbind( 'click' )
            .click( function ( event ) {
                onclick( $( this ), event );
                return false;
            } );
            
            // jq_link.click( onclick ) だと、ツイートを「開く」→「閉じる」した後等にonclickがコールされなくなってしまう(Twitter側のスクリプトでイベントを無効化している？)
            // jq_link.attr( 'onclick', 'javascript:return ' + SCRIPT_NAME + '_click_link' + '( this, window.event || event )' );
            // → [2015.03.20] CSP設定変更により、onclick 属性への設定ができなくなった
            //jq_link.attr( 'target', '_blank' );   //  CSPによるonclick(インラインイベントハンドラ)使用禁止対策
            // → document の mouseover イベントを監視し、onclick イベントが link_dict に登録されている場合には、イベントを再設定するように修正
            
            return link_id;
        }; // end of set_click_handler()
        
        ClickHandlerSaver.prototype.get_click_handler = function ( link_id ) {
            var self = this;
            
            return self.link_dict[ link_id ];
        }; // end of get_click_handler()
        
        return new ClickHandlerSaver();
    } )(),
    
    set_click_handler = function () {
        return click_handler_saver.set_click_handler.apply( click_handler_saver, arguments );
    },
    
    get_click_handler = function () {
        return click_handler_saver.get_click_handler.apply( click_handler_saver, arguments );
    };


function set_url_list_to_jq_link( jq_link, search_url_list ) {
    if ( search_url_list.length < 1 ) {
        jq_link.attr( 'href', '#' );
        jq_link.attr( 'data-search-url-shift', '' );
        return;
    }
    
    jq_link.attr( 'href', search_url_list[ 0 ] );
    
    if ( search_url_list.length < 2 ) {
        jq_link.attr( 'data-search-url-shift', '' );
        return;
    }
    
    jq_link.attr( 'data-search-url-shift', search_url_list[ 1 ] );
} // end of set_url_list_to_jq_link()


var get_jq_link_container = ( function () {
    var jq_link_container_template = $( '<small><a></a></small>' ),
        style = $( '<style/>' );
    
    style.text(
        'a.' + SCRIPT_NAME + '_image {' + [
            'display : inline-block!important',
            'width : 12px!important',
            'height : 12px!important',
            'margin : 0 3px 0 2px!important',
            'padding : 0 0 0 0!important',
            'text-decoration : none!important',
            'background-image : url(' + LINK_ICON_URL + ' )',
            'background-repeat : no-repeat',
            'background-position : 0 0',
            'background-size : 24px 12px'
        ].join( ';\n' ) + '}\n' +
        'a.' + SCRIPT_NAME + '_image:hover {' + [
            'background-position : -12px 0'
        ].join( ';\n' ) + '}\n'
    );
    
    $( 'head' ).append( style );
    
    return function ( search_url_list, options ) {
        var options = ( options ) ? options : {},
            class_name = options.class_name,
            title = options.title,
            text = options.text,
            css = options.css,
            jq_link_container = jq_link_container_template.clone( true ),
            jq_link = jq_link_container.find( 'a:first' );
        
        if ( class_name ) {
            jq_link_container.addClass( class_name );
        }
        if ( title ) {
            jq_link.attr( 'title', title );
        }
        set_url_list_to_jq_link( jq_link , search_url_list );
        
        jq_link.css( { 'font-size' : '12px' } );
        if ( css ) {
            jq_link.css( css );
        }
        
        // TODO: 404 画面だと CSP エラー(Refused to load the image 'data:image/gif;base64,～' ...)になってしまう→除外することで対処
        if ( ( OPTIONS.USE_LINK_ICON ) &&( ! IS_PAGE_404 ) ) {
            jq_link.addClass( SCRIPT_NAME + '_image' );
            jq_link.text( ' ' );
        }
        else {
            if ( text ) {
                jq_link.text( text );
            }
        }
        
        return { container : jq_link_container, link : jq_link };
    }; // end of get_jq_link_container()
} )(); // end of get_jq_link_container()


function start_search_tweet() {
    if ( ! is_search_mode() ) {
        return false;
    }
    
    var current_search_url = SEARCH_PARAMETERS.initial_search_url,
        search_timeline_url = ( function () {
            var filtered_url_list = SEARCH_PARAMETERS.search_url_list.filter( function ( search_url ) {
                    return ( search_url && ( search_url.indexOf( SEARCH_API, 0 ) == 0 ) );
                } );
            
            if ( filtered_url_list.length <= 0 ) {
                return null;
            }
            return filtered_url_list[ 0 ];
        } )(),
        
        target_tweet_id = SEARCH_PARAMETERS.search_tweet_id || SEARCH_PARAMETERS.reacted_tweet_id || ( SEARCH_PARAMETERS.tweet_id_range && SEARCH_PARAMETERS.tweet_id_range.current_id ),
        search_time_sec = SEARCH_PARAMETERS.search_time_sec,
        target_color = SEARCH_PARAMETERS.target_color,
        
        last_tweet_id = null,
        jq_timeline = null,
        giveup_tid = null,
        wait_count = MAX_CHECK_RETRY,
        
        ua = w.navigator.userAgent.toLowerCase(),
        animate_target_selector = ( ( ( ! w.chrome ) && ua.indexOf( 'webkit' ) != -1 ) || ( ua.indexOf( 'opr' ) != -1 ) || ( ua.indexOf( 'edge' ) != -1 ) ) ? 'body' : 'html',
        // [Javascript Chromeでページトップに戻る(scrollTop)が効かなくなってた件。 - かもメモ](http://chaika.hatenablog.com/entry/2017/09/22/090000)
        // ※ 2017/10現在 ($.fn.jquery = 3.1.1)
        //   'html'<= Firefox, Chrome, Vivaldi, IE
        //   'body'<= Safari, Opera, Edge
        animate_speed = 'fast'; //  'slow', 'normal', 'fast' またはミリ秒単位の数値
    
    
    jq_timeline = $( [
            'div.GridTimeline-items',
            'ol.stream-items'
        ].join( ',' ) );
        
    if ( jq_timeline.length <= 0 ) {
        log_error( '*** timeline-items not found ***' );
        return;
    }
    
    giveup_tid = setInterval( function () {
        var jq_last_tweet = jq_timeline.find( '.js-stream-item[data-item-id]:last' ),
            tmp_tweet_id = ( 0 < jq_last_tweet.length ) ? jq_last_tweet.attr( 'data-item-id' ) : null;
        
        if ( ( ! is_search_mode() ) || ( tmp_tweet_id == last_tweet_id ) ) {
            // 読み込まれたタイムラインの最後のツイートにいつまでも変化が無ければ諦める
            clearInterval( giveup_tid );
            giveup_tid = null;
            return;
        }
        last_tweet_id = tmp_tweet_id;
    }, 1000 * WAIT_BEFORE_GIVEUP_SCROLL_SEC );
    
    
    function search_tweet() {
        if ( ! is_search_mode() ) {
            return;
        }
        
        var jq_target_tweet = null,
            retweet_found = false;
        
        if ( target_tweet_id ) {
            jq_target_tweet = jq_timeline.find( [
                'div.js-stream-tweet[data-retweet-id="' + target_tweet_id + '"]:first',
                'div.js-stream-tweet[data-item-id="' + target_tweet_id + '"]:first'
            ].join( ',' ) );
        }
        
        if ( ( jq_target_tweet ) && ( 0 < jq_target_tweet.length ) ) {
            // 目的ツイートが見つかった際の処理
            if ( jq_target_tweet.attr( 'data-retweet-id' ) == target_tweet_id ) {
                retweet_found = true;
                target_color = OPTIONS.VICINITY_TWEET_COLOR;
            }
            log_debug( '*** Pattern A *** :', target_tweet_id, jq_target_tweet.attr( 'data-item-id' ) );
        }
        else {
            // 目的ツイートが見つからない→ツイートIDやタイムスタンプをキーに近傍を探す
            
            jq_target_tweet = null;
            
            if ( $( '.empty-text' ).is( ':visible' ) ) {
                // https://～/with_replies で「@～さんはまだツイートしていません。」が表示される場合、https://twitter.com/search の方へ移動
                if ( search_timeline_url && ( search_timeline_url != current_search_url ) ) {
                    w.location.replace( search_timeline_url + '&_replaced=1' );
                }
                log_debug( '*** empty-text was found ***' );
                return;
            }
            
            jq_timeline.find(
                'div.js-stream-tweet:not(".' + SCRIPT_NAME + '_touched")[data-item-id]'
            )
            .each( function () {
                var jq_tweet = $( this ),
                    tweet_id = jq_tweet.attr( 'data-item-id' ),
                    tweet_time_sec = parseInt( jq_tweet.find( 'span[data-time]:first' ).attr( 'data-time' ) ),
                    retweet_id = jq_tweet.attr( 'data-retweet-id' );
                
                jq_tweet.addClass( SCRIPT_NAME + '_touched' );
                
                if ( target_tweet_id ) {
                    if ( retweet_id ) {
                        // リツイートの場合、tweet_id では無く、retweet_id で比較
                        if ( bignum_cmp( retweet_id, target_tweet_id ) < 0 ) {
                            jq_target_tweet = jq_tweet;
                            return false;
                        }
                    }
                    else {
                        if ( bignum_cmp( tweet_id, target_tweet_id ) < 0 ) {
                            jq_target_tweet = jq_tweet;
                            return false;
                        }
                    }
                }
                
                if ( ( search_time_sec ) && ( tweet_time_sec <= search_time_sec ) ) {
                    jq_target_tweet = jq_tweet;
                    return false;
                }
            } );
            
            if ( ! jq_target_tweet ) {
                // 見つからなかった場合→強制スクロール
                
                if ( ! giveup_tid ) {
                    log_error( '*** give up scrolling ***' );
                    return;
                }
                
                var jq_last_tweet = jq_timeline.find( '.js-stream-item[data-item-id]:last' );
                
                if ( 0 < jq_last_tweet.length ) {
                    log_debug( 'last tweet: data-item-id: ', jq_last_tweet.attr( 'data-item-id' ), ' top: ', jq_last_tweet.offset().top );
                    $( animate_target_selector )
                    .animate( {
                        scrollTop : jq_last_tweet.offset().top
                    }, animate_speed );
                }
                
                if ( $( 'div.stream-end' ).is( ':visible' ) ) {
                    wait_count --;
                    
                    if ( wait_count <= 0 ) {
                        // TODO: 旧版では元ツイートをコピーして挿入する処理が入っていたが、新版では仕組み上困難
                        
                        log_error( '*** stream-end found: retry over ***' );
                        return;
                    }
                    log_debug( 'stream-end found: remaining count =', wait_count );
                }
                else {
                    wait_count = MAX_CHECK_RETRY;
                }
                
                setTimeout( search_tweet, INTV_CHECK_MS );
                
                return;
            }
            
            target_color = OPTIONS.VICINITY_TWEET_COLOR;
            log_debug( '*** Pattern B *** :', target_tweet_id, jq_target_tweet.attr( 'data-item-id' ) );
        }
        
        // 目的ツイートもしくは近傍ツイートが見つかった場合→色を付けて位置を調整
        var jq_tweet_li = ( jq_target_tweet.hasClass( 'js-stream-item' ) ) ? jq_target_tweet : jq_target_tweet.parents( '.js-stream-item' );
        
        if ( jq_tweet_li.length <= 0 ) {
            jq_tweet_li = jq_target_tweet;
        }
        else {
            // TODO: 旧版では元ツイートをコピーして挿入する処理が入っていたが、新版では仕組み上困難
        }
        
        var jq_tweet_li_innter = jq_tweet_li.find( 'div.js-tweet' );
        
        if ( 0 < jq_tweet_li_innter.length ) {
            jq_tweet_li_innter.css( 'background-color', target_color );
        }
        else {
            jq_tweet_li.css( 'background-color', target_color );
        }
        
        function adjust() {
            $( animate_target_selector )
            .animate( {
                scrollTop : jq_tweet_li.offset().top - $( w ).height() / 2
            }, animate_speed );
        } // end of adjust()
        
        adjust();
        
        setTimeout( function () {
            adjust();
            // ※タイムラインが表示しきれておらず目的ツイートを真ん中にもってこれなかった場合等のために時間をずらして再度スクロール
        }, INTV_CHECK_MS );
        
        log_debug( '*** target tweet was found ***' );
        
        return;
    } // end of search_tweet()
    
    search_tweet();
    
    return true;

} // end of start_search_tweet()


function open_search_window( parameters ) {
    var parameters = ( parameters ) ? parameters : {},
        jq_link = parameters.jq_link,
        event = parameters.event,
        search_parameters = parameters.search_parameters,
        target_color = parameters.target_color,
        child_window = parameters.child_window,
        search_url = jq_link.attr( 'href' ),
        search_url_shift = jq_link.attr( 'data-search-url-shift' );
    
    if ( event && ( event.shiftKey || event.altKey ) && search_url_shift ) {
        search_url = search_url_shift;
    }
    
    log_debug( 'open_search_window(): search_url =', search_url );
    
    if ( ! target_color ) {
        target_color = OPTIONS.TARGET_TWEET_COLOR;
    }
    
    search_parameters.target_color = target_color;
    
    child_window = open_child_window( search_url, {
        existing_window : child_window,
        search_parameters : search_parameters
    } );
    
    return child_window;
} // end of open_search_window()


function add_container_to_tweet( jq_tweet, jq_link_container ) {
    var jq_insert_point = jq_tweet.find( 'a.ProfileTweet-timestamp' ).parent();
    
    if ( jq_insert_point.length <= 0 ) {
        jq_insert_point = jq_tweet.find( 'small.time:first' );
    }
    jq_tweet.find( 'div.client-and-actions span.metadata:first' ).after( jq_link_container.clone( true ) );
    if ( jq_insert_point.next().hasClass( 'follow-bar' ) ) {
        jq_link_container.css( 'margin-right','12px' );
    }
    jq_insert_point.after( jq_link_container );
} // end of add_container_to_tweet()


function add_rtlink_to_tweet( jq_tweet, tweet_id ) {
    var retweet_id = jq_tweet.attr( 'data-retweet-id' ),
        retweeter = jq_tweet.attr( 'data-retweeter' );
    
    if ( ( ! retweet_id ) || ( ! retweeter ) ) {
        return;
    }
    
    var search_info = get_search_info( {
            search_tweet_id : retweet_id,
            reacted_tweet_id : tweet_id,
            tweet_id_range : null,
            screen_name : retweeter,
            search_time_sec : null,
            max_id : null
        } ),
        tweet_id_range = search_info.tweet_id_range,
        url_rt_search_list = search_info.search_url_list,
        search_parameters = search_info.search_parameters,
        result = get_jq_link_container( url_rt_search_list, {
            class_name : ACT_CONTAINER_CLASS,
            title : OPTIONS.ACT_LINK_TITLE,
            text : OPTIONS.ACT_LINK_TEXT,
            css : {
                'color' : OPTIONS.ACT_LINK_COLOR,
                'padding' : '4px'
            }
        } ),
        jq_rtlink_container = result.container,
        jq_rtlink = result.link,
        jq_append_point = jq_tweet.find( 'div.ProfileTweet-context:first' );
    
    set_click_handler( jq_rtlink, function ( link, event ) {
        //tweet_search( jq_rtlink, event, retweet_id, null, null, OPTIONS.VICINITY_TWEET_COLOR, ( ( flag_enable_insert ) ? jq_tweet : null ) );
        open_search_window( {
            jq_link : jq_rtlink,
            event : event,
            search_parameters : search_parameters,
            target_color : OPTIONS.VICINITY_TWEET_COLOR,
            child_window : null
        } );
        
        return false;
    } );
    
    // TODO: 旧版では、tweet_id_range が取れなかった場合（ID_THRESHOLD以前のとき）を考慮した処理が書かれていたが、不具合があったため削除
    
    if ( jq_append_point.length <= 0 ) {
        jq_append_point = jq_tweet.find( 'div.context:first' ).find( 'div.with-icn:first' );
    }
    jq_append_point.append( jq_rtlink_container );
    
} // end of add_rtlink_to_tweet()


function add_link_to_tweet( jq_tweet ) {
    var tweet_id = jq_tweet.attr( 'data-item-id' ),
        screen_name = jq_tweet.attr( 'data-screen-name' );
    
    if ( ( ! tweet_id ) || ( ! screen_name ) ) {
        return;
    }
    
    var time_sec = parseInt( jq_tweet.find( 'span[data-time]:first' ).attr( 'data-time' ) ),
        search_info = get_search_info( {
            search_tweet_id : tweet_id,
            tweet_id_range : null,
            screen_name : screen_name,
            search_time_sec : time_sec,
            max_id : null
        } ),
        search_url_list = search_info.search_url_list,
        search_parameters = search_info.search_parameters,
        result = get_jq_link_container( search_url_list, {
            class_name : LINK_CONTAINER_CLASS,
            title : OPTIONS.LINK_TITLE,
            text : OPTIONS.LINK_TEXT,
            css : {
                'color' : OPTIONS.LINK_COLOR,
                'padding' : '4px'
            }
        } ),
        jq_link_container = result.container,
        jq_link = result.link,
        removed_count = jq_tweet.find( 'small.' + LINK_CONTAINER_CLASS ).remove().length; // 既存のものも一旦削除（Twitterによってページが書き換えられるケースに対応）
    
    log_debug( 'add_link_to_tweet(): screen_name:', screen_name, ' tweet_id:', tweet_id, ' removed_count:', removed_count );
    
    set_click_handler( jq_link, function ( jq_link, event ) {
        //tweet_search( jq_link, event, tweet_id, time_sec );
        open_search_window( {
            jq_link : jq_link,
            event : event,
            search_parameters : search_parameters,
            target_color : null,
            child_window : null
        } );
        
        return false;
    } );
    
    add_container_to_tweet( jq_tweet, jq_link_container );
    
    add_rtlink_to_tweet( jq_tweet, tweet_id );
    
} // end of add_link_to_tweet()


function add_link_to_activity( jq_activity ) {
    var jq_timestamp = jq_activity.find( 'div.activity-timestamp span[data-time]:first' );
    if ( jq_timestamp.length < 1 ) {
        return;
    }
    
    var jq_tweet = jq_activity.find( 'div.tweet:first' ),
        tweet_id = ( 0 < jq_tweet.length ) ? jq_tweet.attr( 'data-item-id' ) : jq_activity.find( 'div.js-permalink[data-item-type="tweet"]:first').attr( 'data-item-id' ),
        time_sec = parseInt( jq_timestamp.attr( 'data-time' ) ),
        min_sec = parseInt( jq_activity.attr( 'data-activity-min-position' ) ) / 1000,
        max_sec = parseInt( jq_activity.attr( 'data-activity-max-position' ) ) / 1000,
        removed_count = jq_activity.find( 'small.' + ACT_CONTAINER_CLASS ).remove().length; // 既存のものも一旦削除（Twitterによってページが書き換えられるケースに対応
    
    log_debug( 'add_link_to_activity(): time:', time_sec, ' min:', min_sec, ' max:', max_sec, ' removed_count:', removed_count );
    
    jq_activity.find( 'a.js-user-profile-link[data-user-id],a.js-profile-popup-actionable' )
    .each( function () {
        var jq_user_link = $( this ),
            screen_name = jq_user_link.attr( 'href' ).replace( /^.*\//, '' ),
            search_info = get_search_info( {
                search_tweet_id : null,
                reacted_tweet_id : tweet_id,
                tweet_id_range : null,
                screen_name : screen_name,
                search_time_sec : time_sec,
                search_time_range : {
                    time_sec : time_sec,
                    min_sec : min_sec,
                    max_sec : max_sec
                },
                max_id : null
            } ),
            search_url_list = search_info.search_url_list,
            search_parameters = search_info.search_parameters,
            result = get_jq_link_container( search_url_list, {
                class_name : ACT_CONTAINER_CLASS,
                title : OPTIONS.ACT_LINK_TITLE,
                text : OPTIONS.ACT_LINK_TEXT,
                css : {
                    'color' : OPTIONS.ACT_LINK_COLOR
                }
            } ),
            jq_link_container = result.container,
            jq_link = result.link;
        
        set_click_handler( jq_link, function ( link, event ) {
            //tweet_search( jq_link, event, tweet_id, min_sec, null, OPTIONS.VICINITY_TWEET_COLOR, jq_activity );
            open_search_window( {
                jq_link : jq_link,
                event : event,
                search_parameters : search_parameters,
                target_color : OPTIONS.VICINITY_TWEET_COLOR,
                child_window : null
            } );
            
            return false;
        } );
        
        if ( jq_user_link.hasClass( 'js-profile-popup-actionable' ) && jq_link.hasClass( SCRIPT_NAME + '_image' ) ) {
            // アバターアイコンに挿入する際のマージン調整
            jq_user_link.find( 'img.avatar' ).css( {
                'margin-right' : '0'
            } );
        }
        jq_user_link.after( jq_link_container );
    } );
    
} // end of add_link_to_activity()


function hide_newer_tweet( jq_tweet, threshold_tweet_id ) {
    if ( ! threshold_tweet_id ) {
        return false;
    }
    
    var tweet_id = jq_tweet.attr( 'data-retweet-id' ) || jq_tweet.attr( 'data-item-id' );
    
    if ( bignum_cmp( tweet_id, threshold_tweet_id ) < 0 ) {
        return false;
    }
    
    var jq_container = null;
    
    jq_tweet.parents( SELECTOR_INFO.tweet_wrapper_selector )
    .each( function () {
        var jq_tweet_wrapper = $( this );
        
        if ( 0 < jq_tweet_wrapper.parent( SELECTOR_INFO.container_selector ).length ) {
            jq_container = jq_tweet_wrapper;
            return false;
        }
    } );
    
    if ( ! jq_container ) {
        return false;
    }
    
    jq_tweet.hide();
    jq_container.hide();
    
    log_debug( '* notice *: hide ', tweet_id, jq_tweet );
    
    return true;
} // end of hide_newer_tweet()


function hide_newer_tweet_container( jq_target, threshold_tweet_id ) {
    if ( ! threshold_tweet_id ) {
        return false;
    }
    
    ( jq_target.hasClass( 'js-new-tweets-bar' ) ? jq_target : jq_target.find( 'div.js-new-tweets-bar') )
    .each( function () {
        var jq_new_bar = $( this ),
            jq_container = jq_new_bar.parent( 'div.stream-item' );
        
        if ( jq_container.length <= 0 ) {
            return;
        }
        
        jq_new_bar.hide();
        jq_container.hide();
        
        log_debug( '* notice *: hide new tweets bar', jq_new_bar );
    } );
    
    return true;
} // end of hide_newer_tweet_container()


function check_changed_node( target_node ) {
    if ( ( ! target_node ) || ( target_node.nodeType != 1 ) ) {
        return false;
    }
    
    var jq_target = $( target_node ),
        hide_threshold_tweet_id = get_hide_threshold_tweet_id();
    
    ( ( jq_target.hasClasses( SELECTOR_INFO.tweet_class_names, true ) ) ? jq_target : jq_target.find( SELECTOR_INFO.simple_tweet_selector ) )
    .each( function () {
        var jq_tweet = $( this );
        
        if ( jq_tweet.parents( SELECTOR_INFO.container_selector ).length <= 0 ) {
            return;
        }
        
        add_link_to_tweet( jq_tweet );
        
        hide_newer_tweet( jq_tweet, hide_threshold_tweet_id );
    } );
    
    ( ( jq_target.hasClasses( SELECTOR_INFO.activity_class_names, true ) ) ? jq_target : jq_target.find( SELECTOR_INFO.activity_selector ) )
    .each( function () {
        var jq_activity = $( this );
        
        add_link_to_activity( jq_activity );
    } );
    
    hide_newer_tweet_container( jq_target, hide_threshold_tweet_id );
    
} // end of check_changed_node()


function start_tweet_observer() {
    var observer = new MutationObserver( function ( records ) {
            log_debug( '*** MutationObserver ***' );
            
            records.forEach( function ( record ) {
                var target = record.target;
                                
                to_array( record.addedNodes ).forEach( function ( addedNode ) {
                    check_changed_node( addedNode );
                } );
            } );
        } );
    
    observer.observe( d.body, { childList : true, subtree : true } );
    
    /*
    //$( d ).mouseover( function ( event ){
    //   // set_click_handler() でセットした click イベントが、ツイートを「開く」→「閉じる」を実施すると無効化される(Twitter側のスクリプトの動作と思われる)
    //   // → mouseover イベント発火時に、click イベントを再設定することで対応
    //    
    //    var jq_target = $( event.target ),
    //        onclick = get_click_handler( jq_target.attr( 'id' ) );
    //    
    //    if ( onclick ) {
    //        jq_target
    //        .unbind( 'click' );
    //        .click( function ( event ) {
    //            onclick( $( this ), event );
    //            return false;
    //        } );
    //    }
    //} );
    // TODO: MutationObserver() で既存のリンクがあればそれをいったん削除して再挿入することで対処できるのではないかと様子見中
    */
} // end of start_tweet_observer()


function check_404_page() {
    if ( ! IS_PAGE_404 ) {
        return false;
    }
    
    var tweet_info = parse_individual_tweet_url( w.location.href );
    
    if ( ! tweet_info ) {
        return false;
    }
    
    var screen_name = tweet_info.screen_name,
        tweet_id = tweet_info.tweet_id,
        search_info = get_search_info( {
            search_tweet_id : tweet_id,
            tweet_id_range : null,
            screen_name : screen_name,
            search_time_sec : null,
            max_id : null
        } ),
        search_url_list = search_info.search_url_list,
        search_parameters = search_info.search_parameters,
        result = get_jq_link_container( search_url_list, {
            class_name : LINK_CONTAINER_CLASS,
            title : OPTIONS.LINK_TITLE,
            text : OPTIONS.LINK_TEXT,
            css : {
                'color' : OPTIONS.LINK_COLOR,
                'padding' : '4px'
            }
        } ),
        jq_link_container = result.container,
        jq_link = result.link;
    
    jq_link_container.css( {
        'display' : 'inline-block',
        'background-color' : 'lightyellow'
    } );
    
    jq_link.css( {
        'color' : '#0084b4',
        'font-size' : '16px',
        'font-weight' : 'bold'
    } );
    
    set_click_handler( jq_link, function ( jq_link, event ) {
        open_search_window( {
            jq_link : jq_link,
            event : event,
            search_parameters : search_parameters,
            target_color : null,
            child_window : null
        } );
        
        return false;
    } );
    
    var jq_h1 = $( 'h1:first' ),
        h1_html = jq_h1.html(),
        html_lang = $( 'html' ).attr( 'lang' );
    
    if ( ( html_lang == LANGUAGE ) || ( ! h1_html.match( /sorry/i ) ) ) {
        jq_h1.append( jq_link );
    }
    else {
        var observer = new MutationObserver( function ( records ) {
                var jq_h1 = $( 'h1:first' );
                
                if ( jq_h1.html() == h1_html ) {
                    return;
                }
                jq_h1.append( jq_link_container );
                
                observer.disconnect();
            } );
        
        observer.observe( d.body, { childList : true, subtree : true } );
    }
    
    return true;

} // end of check_404_page()


function initialize( user_options ) {
    log_debug( 'Initializing...' );
    log_debug( 'document.referrer : ', d.referrer );
    
    if ( user_options ) {
        Object.keys( user_options ).forEach( function ( name ) {
            if ( user_options[ name ] === null ) {
                return;
            }
            OPTIONS[ name ] = user_options[ name ];
        } );
    }
    
    if ( ! OPTIONS.OPERATION ) {
        return;
    }
    
    ID_BEFORE = Decimal.mul( ID_INC_PER_SEC, OPTIONS.HOUR_BEFORE * 3600 );
    ID_AFTER = Decimal.mul( ID_INC_PER_SEC, OPTIONS.HOUR_AFTER * 3600 );
    ID_THRESHOLD = new Decimal( ID_THRESHOLD );
    
    log_debug( 'ID_INC_PER_SEC =', ID_INC_PER_SEC.toString() );
    log_debug( 'ID_BEFORE =', ID_BEFORE.toString() );
    log_debug( 'ID_AFTER =', ID_AFTER.toString() );
    log_debug( 'ID_THRESHOLD =', ID_THRESHOLD.toString() );
    log_debug( 'SEARCH_PARAMETERS =', SEARCH_PARAMETERS );
    
    if ( check_404_page() ) {
        // 404 ページ→ H1 に近傍リンクをセットして終了
        return;
    }
    
    check_changed_node( d.body );
    
    start_tweet_observer();
    
    start_search_tweet();
    
    log_debug( 'All set.' );

} // end of initialize()


// ■ エントリポイント
if ( typeof w.twDisplayVicinity_chrome_init == 'function' ) {
    // Google Chorme 拡張機能から実行した場合、ユーザーオプションを読み込む
    w.twDisplayVicinity_chrome_init( function ( user_options ) {
        initialize( user_options );
    } );
}
else {
    initialize();
}

} )( window, document );

// ■ end of file
