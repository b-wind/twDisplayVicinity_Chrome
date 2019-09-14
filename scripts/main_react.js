// 【React 版 Twitter 用・近傍ツイート検索 メイン処理】

( ( w, d ) => {

'use strict';

w.chrome = ( ( typeof browser != 'undefined' ) && browser.runtime ) ? browser : chrome;

//{ ■ パラメータ
var OPTIONS = {
    USE_SEARCH_TL_BY_DEFAULT : false, // true: デフォルトで検索タイムラインを使用
    
    HOUR_BEFORE : 24, // 対象ツイートから遡る期間(時間)
    //HOUR_AFTER : 8, // 対象ツイートより後の期間(時間)
    HOUR_AFTER : 3, // 対象ツイートより後の期間(時間)
    
    // DAY_BEFORE / DAY_AFTER は、検索タイムラインで  until: / since: が "YYYY-MM-DD_hh:mm:ss_GMT" の形で指定できることが判明したので未使用とする
    DAY_BEFORE : 1, // (未使用) 対象ツイートから遡る期間(日)(検索タイムライン用・時間指定時)
    DAY_AFTER : 1, // (未使用) 対象ツイートより後の期間(日)(検索タイムライン用・時間指定時)
    
    IGNORE_SINCE : true, // true: 検索タイムラインのオプションに since: を付けない
    
    TARGET_TWEET_COLOR : 'gold', // 対象ツイートの色
    TARGET_TWEET_COLOR_NIGHTMODE : '#444400', // 対象ツイートの色（夜間モード）
    VICINITY_TWEET_COLOR : 'pink', // 近傍ツイートの色
    VICINITY_TWEET_COLOR_NIGHTMODE : '#440044', // 近傍ツイートの色（夜間モード）
    // TODO: 夜間モードだと見えにくいため、暫定的に 'inherit' にしてある
    LINK_COLOR : 'inherit', // 近傍リンクの色('darkblue'→'inherit')
    ACT_LINK_COLOR : 'inherit', // 通知リンクの色('indigo'→'inherit')
    
    HIDE_NEWER_TWEETS : true, // true: 最新のツイート(追加されたもの)を非表示
    USE_LINK_ICON : true, // 近傍リンクの種類（true: アイコンを使用 ／ false: 文字を使用
    
    ENABLE_RECENT_RETWEET_USERS_BUTTON : true, // true: 最近リツイートしたユーザーを表示するボタンを有効に
    CACHE_OAUTH2_ACCESS_TOKEN : true, // true: OAuth2 の Access Token を再利用する
    MAX_USER_NUMBER : 30, // 取得ユーザー数(API制限により、100ユーザまで) (ENABLE_RECENT_RETWEET_USERS_BUTTON が true の場合に使用)
    MAX_AFTER_RETWEET_MINUTES : 10, // リツイート後のツイート取得期間(分)
    MAX_BEFORE_RETWEET_MINUTES : 10, // リツイート前のツイート取得時間(分)
    
    OPEN_LINK_KEYCODE : 70, // 近傍ツイート検索キーコード([f]:70)
    HELP_OPEN_LINK_KEYCHAR : 'f', // 近傍ツイート検索キー表示
    
    OPEN_ACT_LINK_KEYCODE : 65, // アクションの近傍ツイート検索キーコード([a]:65)
    HELP_OPEN_ACT_LINK_KEYCHAR : 'a', // アクションの近傍ツイート検索キー
    
    TOGGLE_RERT_DIALOG_KEYCODE : 69, // [Re:RT]ダイアログを開く/閉じるキーコード([e]:69)
    HELP_OPEN_RERT_DIALOG_KEYCHAR : 'e', // [Re:RT]ダイアログを開くキー表示
    
    STATUSES_RETWEETS_CACHE_SEC : 0, // statuses/retweets API のキャッシュを保持する時間(秒)(0:保持しない)
    
    OBSERVE_DOM_FETCH_DATA : false, // true: fetch wrapper で取得した内容を DOM 要素に書き出し、MutationObserver で監視
    
    OPERATION : true // true: 動作中、false: 停止中
};

//}


//{ ■ 共通変数
var SCRIPT_NAME = 'twDisplayVicinity_React',
    SCRIPT_NAME_JA = '近傍ツイート検索',
    
    DEBUG = false;

//{ 実行環境の確認

if ( ! w.is_web_extension ) {
    // TODO: ユーザースクリプトとしての動作は未対応（拡張機能のみ対応）
    return;
}

if ( ! d.querySelector( 'div#react-root' ) ) {
    return;
}

if ( w !== w.parent ) {
    return;
}

if ( ( typeof jQuery != 'function' ) || ( typeof Decimal != 'function' ) ) {
    console.error( SCRIPT_NAME + ':', 'Library not found', typeof jQuery, typeof Decimal );
    return;
}

var $ = jQuery,
    
    IS_TOUCHED = ( function () {
        var touched_id = SCRIPT_NAME + '_touched',
            $touched = $( '#' + touched_id );
        
        if ( 0 < $touched.length ) {
            return true;
        }
        
        $( '<b>' ).attr( 'id', touched_id ).css( 'display', 'none' ).appendTo( $( d.documentElement ) );
        
        return false;
    } )(),
    
    LANGUAGE = ( function () {
        return $( 'html' ).attr( 'lang' );
    } )(),
    
    IS_FIREFOX = ( 0 <= w.navigator.userAgent.toLowerCase().indexOf( 'firefox' ) ),
    IS_EDGE = ( 0 <= w.navigator.userAgent.toLowerCase().indexOf( 'edge' ) );

if ( IS_TOUCHED ) {
    console.error( SCRIPT_NAME + ': Already loaded.' );
    return;
}

//}


switch ( LANGUAGE ) {
    case 'ja' :
        OPTIONS.LINK_TEXT = '近傍';
        OPTIONS.LINK_TITLE = '近傍ツイート検索';
        OPTIONS.ACT_LINK_TEXT = '近傍';
        OPTIONS.ACT_LINK_TITLE = 'アクションの近傍ツイート検索';
        OPTIONS.GO_TO_PAST_TEXT = '以前のツイート↓';
        OPTIONS.CLOSE_TEXT = '閉じる';
        OPTIONS.RECENT_RETWEET_USERS_TEXT = '最近リツイートしたユーザー';
        OPTIONS.LOADING_TEXT = '取得中...';
        OPTIONS.LOADING_ERROR_TEXT = '読み込めませんでした';
        OPTIONS.RECENT_RETWEET_USERS_BUTTON_TITLE = '最近リツイートしたユーザーを表示';
        OPTIONS.RECENT_RETWEET_USERS_BUTTON_TEXT = 'Re:RT';
        OPTIONS.REFERECE_TO_RETWEET_LOAD_BUTTON_TITLE = 'リツイート前後のツイートを取得';
        OPTIONS.REFERECE_TO_RETWEET_LOAD_BUTTON_TEXT = '↓↑';
        OPTIONS.REFERECE_TO_RETWEET_CLOSE_BUTTON_TITLE = '閉じる';
        OPTIONS.REFERECE_TO_RETWEET_CLOSE_BUTTON_TEXT = '↑';
        OPTIONS.REFERECE_TO_RETWEET_OPEN_BUTTON_TITLE = '開く';
        OPTIONS.REFERECE_TO_RETWEET_OPEN_BUTTON_TEXT = '↓';
        OPTIONS.REFERECE_TO_RETWEET_LOAD_ALL_BUTTON_TITLE = '全てのリツイート前後のツイートを取得';
        OPTIONS.REFERECE_TO_RETWEET_LOAD_ALL_BUTTON_TEXT = 'まとめて ↓↑';
        OPTIONS.REFERECE_TO_RETWEET_CLOSE_ALL_BUTTON_TITLE = '全て閉じる';
        OPTIONS.REFERECE_TO_RETWEET_CLOSE_ALL_BUTTON_TEXT = '全て↑';
        OPTIONS.REFERECE_TO_RETWEET_OPEN_ALL_BUTTON_TITLE = '全て開く';
        OPTIONS.REFERECE_TO_RETWEET_OPEN_ALL_BUTTON_TEXT = '全て↓';
        OPTIONS.HELP_OPEN_RERT_DIALOG_LABEL = '[Re:RT]ダイアログを開く';
        break;
    default:
        OPTIONS.LINK_TEXT = 'Vicinity';
        OPTIONS.LINK_TITLE = 'Search vicinity tweets';
        OPTIONS.ACT_LINK_TEXT = 'Vicinity';
        OPTIONS.ACT_LINK_TITLE = 'Search vicinity tweets around action';
        OPTIONS.GO_TO_PAST_TEXT = 'Go to past ↓';
        OPTIONS.CLOSE_TEXT = 'Close';
        OPTIONS.RECENT_RETWEET_USERS_TEXT = 'Recent Retweeters';
        OPTIONS.LOADING_TEXT = 'Loading...';
        OPTIONS.LOADING_ERROR_TEXT = 'Load error';
        OPTIONS.RECENT_RETWEET_USERS_BUTTON_TITLE = 'Display recent users that have retweeted';
        OPTIONS.RECENT_RETWEET_USERS_BUTTON_TEXT = 'Re:RT';
        OPTIONS.REFERECE_TO_RETWEET_LOAD_BUTTON_TITLE = 'Retrieve Tweets around this Retweet';
        OPTIONS.REFERECE_TO_RETWEET_LOAD_BUTTON_TEXT = '↓↑';
        OPTIONS.REFERECE_TO_RETWEET_CLOSE_BUTTON_TITLE = 'Close';
        OPTIONS.REFERECE_TO_RETWEET_CLOSE_BUTTON_TEXT = '↑';
        OPTIONS.REFERECE_TO_RETWEET_OPEN_BUTTON_TITLE = 'Open';
        OPTIONS.REFERECE_TO_RETWEET_OPEN_BUTTON_TEXT = '↓';
        OPTIONS.REFERECE_TO_RETWEET_LOAD_ALL_BUTTON_TITLE = 'Retrieve Tweets around all Retweets';
        OPTIONS.REFERECE_TO_RETWEET_LOAD_ALL_BUTTON_TEXT = 'All ↓↑';
        OPTIONS.REFERECE_TO_RETWEET_CLOSE_ALL_BUTTON_TITLE = 'Close All';
        OPTIONS.REFERECE_TO_RETWEET_CLOSE_ALL_BUTTON_TEXT = 'All ↑';
        OPTIONS.REFERECE_TO_RETWEET_OPEN_ALL_BUTTON_TITLE = 'Open All';
        OPTIONS.REFERECE_TO_RETWEET_OPEN_ALL_BUTTON_TEXT = 'All ↓';
        OPTIONS.HELP_OPEN_RERT_DIALOG_LABEL = 'Open [Re:RT] dialog';
        break;
}

var SEARCH_API = 'https://twitter.com/search',
    TIMELINE_API_BASE = 'https://twitter.com/',
    //OAUTH2_TOKEN_API_URL = 'https://api.twitter.com/oauth2/token',
    //ENCODED_TOKEN_CREDENTIAL = 'ZUMwYjVTcDdTTW0xaUtES3lwQ3AySkpkZDpsbHMxZ040Q0ZQMFhmSmtvbEk2UjBZMkd6aWxjbHhqQUlrZkVZSHl3Ymh6TjhZcURlSA==',
    API_RATE_LIMIT_STATUS = 'https://api.twitter.com/1.1/application/rate_limit_status.json',
    API_STATUSES_RETWEETS_TEMPLATE = 'https://api.twitter.com/1.1/statuses/retweets/#TWEETID#.json?count=#NUMBER#',
    API_FAVORITES_LIST_TEMPLATE = 'https://api.twitter.com/1.1/favorites/list.json?screen_name=#SCREEN_NAME#&count=200&include_entities=true',
        // TODO: 「いいね」の方は API の仕様上、使い勝手がよくないため、保留
    OAUTH2_ACCESS_TOKEN = null,
    
    API_AUTHORIZATION_BEARER = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA',
    // TODO: 継続して使えるかどうか不明→変更された場合の対応を要検討
    // ※ https://abs.twimg.com/responsive-web/web/main.<version>.js (例：https://abs.twimg.com/responsive-web/web/main.007c24006b6719434.js) 内で定義されている値
    API_USER_TIMELINE_TEMPLATE = 'https://api.twitter.com/1.1/statuses/user_timeline.json?count=#COUNT#&include_my_retweet=1&include_rts=1&user_id=#USER_ID#&cards_platform=Web-13&include_entities=1&include_user_entities=1&include_cards=1&send_error_codes=1&tweet_mode=extended&include_ext_alt_text=true&include_reply_count=true',
    
    
    VICINITY_LINK_CONTAINER_CLASS = SCRIPT_NAME + '_vicinity_link_container',
    SELF_CONTAINER_CLASS = SCRIPT_NAME + '_vicinity_link_container_self',
    ACT_CONTAINER_CLASS = SCRIPT_NAME + '_vicinity_link_container_act',
    VICINITY_LINK_CLASS = SCRIPT_NAME + '_vicinity_link',
    RECENT_RETWEETS_BUTTON_CLASS = SCRIPT_NAME + '-recent-retweets-button',
    TARGET_TWEET_CLASS = SCRIPT_NAME + '-target-tweet',
    VICINITY_TWEET_CLASS = SCRIPT_NAME + '-vicinity-tweet',
    
    //INTV_CHECK_MS = 300, // チェック間隔(単位：ms)
    //MAX_CHECK_RETRY = 10, // 'div.stream-end' 要素が表示されてから、チェックを終了するまでのリトライ回数(タイミングにより、いったん表示されてもまた消える場合がある)
    
    WAIT_DOM_REFRESH_MS = 100, // 通信データ通知→DOM更新待ち時間(単位：ms)
    WAIT_BEFORE_GIVEUP_SCROLL_SEC = 30, // 強制スクロールさせてタイムラインの続きを読み込む際に、いつまでも変化が見られず、諦めるまでの時間(単位:秒)
    
    MAX_ADJUST_SCROLL_NUMBER = 30, // ツイート検索後の位置調整でチェックする最大数
    ADJUST_CHECK_INTERVAL_MS = 200, // 同・チェック間隔(単位：ms)
    ADJUST_ACCEPTABLE_NUMBER = 5, // 同・ツイートのスクロール位置が安定するまでの回数（連続してADJUST_ACCEPTABLE_NUMBER回一致すれば安定したとみなす）
    
    LIMIT_STATUSES_RETWEETS_USER_NUMBER = 100, // statuses/retweets のユーザー数制限
    DEFAULT_STATUSES_RETWEETS_USER_NUMBER = 30, // statuses/retweets のデフォルトユーザー数
    LIMIT_MAX_AFTER_RETWEET_MINUTES = 60, // リツイート後のツイート取得時間(分)制限
    DEFAULT_MAX_AFTER_RETWEET_MINUTES = 10, // リツイート後のツイート取得時間(分)デフォルト
    LIMIT_MAX_BEFORE_RETWEET_MINUTES = 60, // リツイート前のツイート取得時間(分)制限
    DEFAULT_MAX_BEFORE_RETWEET_MINUTES = 10, // リツイート前のツイート取得時間(分)デフォルト
    
    ID_INC_PER_MSEC = Decimal.pow( 2, 22 ), // ミリ秒毎のID増分
    ID_INC_PER_SEC = ID_INC_PER_MSEC.mul( 1000 ), // 秒毎のID増分
    FIRST_TWEET_ID = 20,
    FIRST_TWEET_OFFSET_MSEC = 1142974214000,
    ID_INC_PER_SEC_LEGACY = Math.round( 1000 * ( 29694409027 - FIRST_TWEET_ID ) / ( 1288898870000 - FIRST_TWEET_OFFSET_MSEC ) ), // ID 切替以前の増加分
    // TODO: ID 切替以前は増加分がわからない
    // → 暫定的に、https://twitter.com/jack/status/20 (data-time-ms: 1142974214000) → https://twitter.com/Twitter/status/29694409027 (data-time-ms: 1288898870000) の平均をとる
    
    TWEPOCH_OFFSET_MSEC = 1288834974657,
    TWEPOCH_OFFSET_SEC = Math.ceil( TWEPOCH_OFFSET_MSEC / 1000 ), // 1288834974.657 sec (2011.11.04 01:42:54(UTC)) (via http://www.slideshare.net/pfi/id-15755280)
    ID_THRESHOLD = '300000000000000', // 2010.11.04 22時(UTC)頃に、IDが 30000000000以下から300000000000000以上に切り替え
    ID_BEFORE = null,
    ID_AFTER = null,
    ID_BEFORE_LEGACY = null,
    ID_AFTER_LEGACY = null,
    
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
    
    SEARCH_PARAMETERS = ( function () {
        if ( ! w.opener ) {
            return {};
        }
        
        var search_parameters = {},
            current_url = location.href,
            comparison_url = current_url;
        
        try {
            search_parameters = JSON.parse( w.name );
            
            if ( ! search_parameters ) {
                return {};
            }
            
            if ( search_parameters.search_url != comparison_url ) {
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

//}


//{ ■ 関数

function to_array( array_like_object ) {
    return Array.prototype.slice.call( array_like_object );
} // end of to_array()


//{ ログ関連
if ( typeof console.log.apply == 'undefined' ) {
    // MS-Edge 拡張機能では console.log.apply 等が undefined
    // → apply できるようにパッチをあてる
    // ※参考：[javascript - console.log.apply not working in IE9 - Stack Overflow](https://stackoverflow.com/questions/5538972/console-log-apply-not-working-in-ie9)
    
    [ 'log', 'info', 'warn', 'error', 'assert', 'dir', 'clear', 'profile', 'profileEnd' ].forEach( function ( method ) {
        console[ method ] = this.bind( console[ method ], console );
    }, Function.prototype.call );
    
    console.log( 'note: console.log.apply is undefined => patched' );
}


function log_debug() {
    if ( ! DEBUG ) {
        return;
    }
    var arg_list = [ '[' + SCRIPT_NAME + ']', '(' + ( new Date().toISOString() ) + ')' ];
    
    console.log.apply( console, arg_list.concat( to_array( arguments ) ) );
} // end of log_debug()


function log_info() {
    var arg_list = [ '[' + SCRIPT_NAME + ']', '(' + ( new Date().toISOString() ) + ')' ];
    
    console.info.apply( console, arg_list.concat( to_array( arguments ) ) );
} // end of log_info()


function log_error() {
    var arg_list = [ '[' + SCRIPT_NAME + ']', '(' + ( new Date().toISOString() ) + ')' ];
    
    console.error.apply( console, arg_list.concat( to_array( arguments ) ) );
} // end of log_error()

//}

var set_value = ( function () {
    if ( typeof GM_setValue != 'undefined' ) {
        return function ( name, value ) {
            return GM_setValue( name, value );
        };
    }
    return function ( name, value ) {
        return localStorage.setItem( name, value );
    };
} )(); // end of set_value()


var get_value = ( function () {
    if ( typeof GM_getValue != 'undefined' ) {
        return function ( name ) {
            var value = GM_getValue( name );
            
            // メモ： 値が存在しない場合、GM_getValue( name ) は undefined を返す
            return ( value === undefined ) ? null : value;
        };
    }
    return function ( name ) {
        // メモ： 値が存在しない場合、localStorage[ name ] は undefined を、localStorage.getItem( name ) は null を返す
        return localStorage.getItem( name );
    };
} )(); // end of get_value()


var object_extender = ( function () {
    function object_extender( base_object ) {
        var template = object_extender.template;
        
        template.prototype = base_object;
        
        var expanded_object = new template(),
            object_list = to_array( arguments );
        
        object_list.shift();
        object_list.forEach( function ( object ) {
            Object.keys( object ).forEach( function ( name ) {
                expanded_object[ name ] = object[ name ];
            } );
        } );
        
        return expanded_object;
    } // end of object_extender()
    
    
    object_extender.template = function () {};
    
    return object_extender;
} )(); // end of object_extender()


// 参考: [複数のクラス名の存在を確認（判定） | jQuery逆引き | Webサイト制作支援 | ShanaBrian Website](http://shanabrian.com/web/jquery/has-classes.php)
$.fn.hasClasses = function( selector, or_flag ) {
    var self = this,
        class_names,
        counter = 0;
    
    if ( typeof selector === 'string' ) {
        selector = selector.trim();
        class_names = ( selector.match( /^\./ ) ) ? selector.replace( /^\./, '' ).split( '.' ) : selector.split( ' ' );
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


function is_error_page() {
    return ( 0 < $( 'div[data-testid="primaryColumn"] h1[role="heading"][data-testid="error-detail"]' ).length );
} // end of is_error_page()


function is_night_mode() {
    return ( getComputedStyle( d.body ).backgroundColor != 'rgb(255, 255, 255)' );
} // end of is_night_mode()


function is_search_mode() {
    var initial_search_url = SEARCH_PARAMETERS.initial_search_url;
    
    return ( ( initial_search_url ) && ( location.href == initial_search_url ) );
} // end of is_search_mode()


function update_display_mode() {
    $( d.body ).attr( 'data-nightmode', is_night_mode() );
} // end of update_display_mode()


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
            .replace( /S/g, function ( all ) {
                return msec.charAt( msec_index ++ );
            } );
    }
    else {
        format = format
            .replace( /YYYY/g, date.getFullYear() )
            .replace( /MM/g, ( '0' + ( 1 + date.getMonth() ) ).slice( -2 ) )
            .replace( /DD/g, ( '0' + date.getDate() ).slice( -2 ) )
            .replace( /hh/g, ( '0' + date.getHours() ).slice( -2 ) )
            .replace( /mm/g, ( '0' + date.getMinutes() ).slice( -2 ) )
            .replace( /ss/g, ( '0' + date.getSeconds() ).slice( -2 ) )
            .replace( /S/g, function ( all ) {
                return msec.charAt( msec_index ++ );
            } );
    }
    
    return format;
} // end of format_date()


function bignum_cmp( bignum_left, bignum_right ) {
    return new Decimal( bignum_left ).cmp( bignum_right );
} // end of bignum_cmp()


var get_jq_html_fragment = ( function () {
    if ( ( ! d.implementation ) || ( typeof d.implementation.createHTMLDocument != 'function' ) ) {
        return function ( html ) {
            return $( '<div/>' ).html( html );
        };
    }
    
    // 解析段階での余分なネットワークアクセス（画像等の読み込み）抑制
    var html_document = d.implementation.createHTMLDocument(''),
        range = html_document.createRange();
    
    return function ( html ) {
        return $( range.createContextualFragment( html ) );
    };
} )(); // end of get_jq_html_fragment()


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


function tweet_id_to_date_legacy( tweet_id ) {
    var bignum_tweet_id = new Decimal( tweet_id );
    
    if ( bignum_tweet_id.cmp( ID_THRESHOLD ) >= 0 ) {
        return tweet_id_to_date( tweet_id );
    }
    return new Date( parseInt( bignum_tweet_id.sub( 20 ).div( ID_INC_PER_SEC_LEGACY ).mul( 1000 ).floor().add( FIRST_TWEET_OFFSET_MSEC ), 10 ) );
} // end of tweet_id_to_date_legacy()


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


function get_date_from_tweet_id( tweet_id, offset_sec ) {
    var tweet_date = tweet_id_to_date( tweet_id );
    
    if ( ! tweet_date ) {
        return null;
    }
    
    return new Date( tweet_date.getTime() + ( ( offset_sec ) ? ( 1000 * offset_sec ) : 0 ) );
} // end of get_date_from_tweet_id()


function tweet_id_shift( tweet_id, offset_sec ) {
    var tweet_date_shift = get_date_from_tweet_id( tweet_id, offset_sec );
    
    if ( ! tweet_date_shift ) {
        return null;
    }
    
    return datetime_to_tweet_id( tweet_date_shift );
} // end of tweet_id_shift()


function get_gmt_date( time_sec ) {
    var date = new Date( 1000 * time_sec );
    
    return format_date( date, 'YYYY-MM-DD', true );
} // end of get_gmt_date()


function get_gmt_datetime( time, is_msec ) {
    var date = new Date( ( is_msec ) ? time : 1000 * time );
    
    return format_date( date, 'YYYY-MM-DD_hh:mm:ss_GMT', true );
} // end of get_gmt_datetime()


function get_gmt_datetime_from_tweet_id( tweet_id, offset_sec ) {
    var tweet_date_shift = get_date_from_tweet_id( tweet_id, offset_sec );
    
    if ( ! tweet_date_shift ) {
        return null;
    }
    
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
    
    if ( bignum_cmp( search_tweet_id, ID_THRESHOLD ) < 0 ) {
        return null;
    }
    
    var current_id = new Decimal( search_tweet_id ),
        since_id = current_id.sub( ID_BEFORE ).sub( 1 ),
        max_id = current_id.add( ID_AFTER );
    
    if ( ( reacted_tweet_id ) && ( bignum_cmp( since_id, reacted_tweet_id ) < 0 ) ) {
        since_id = new Decimal( reacted_tweet_id ).sub( 1 );
    }
    
    log_debug( 'since_id:', since_id.toString(), ' current_id:', current_id.toString(), ' max_id:', max_id.toString() );
    
    return {
        current_id : current_id.toString(),
        since_id : since_id.toString(),
        max_id: max_id.toString()
    };
} // end of get_tweet_id_range()


function get_tweet_id_range_legacy( search_tweet_id, reacted_tweet_id ) {
    if ( ( ! ID_BEFORE_LEGACY ) || ( ! ID_AFTER_LEGACY ) || ( ! search_tweet_id ) ) {
        return null;
    }
    
    if ( bignum_cmp( ID_THRESHOLD, search_tweet_id ) <= 0 ) {
        return null;
    }
    
    var current_id = new Decimal( search_tweet_id ),
        since_id = current_id.sub( ID_BEFORE_LEGACY ).sub( -1 ),
        max_id = current_id.add( ID_AFTER_LEGACY );
    
    if ( ( reacted_tweet_id ) && ( bignum_cmp( since_id, reacted_tweet_id ) < 0 ) ) {
        since_id = new Decimal( reacted_tweet_id ).sub( -1 );
    }
    
    if ( since_id.cmp( 0 ) < 0 ) {
        since_id = new Decimal( 0 );
    }
    
    return {
        current_id : current_id.toString(),
        since_id : since_id.toString(),
        max_id: max_id.toString()
    };
} // end of get_tweet_id_range_legacy()


function get_screen_name_from_url( url ) {
    if ( ! url ) {
        url = location.href;
    }
    
    if ( ! url.match( /^(?:https?:\/\/[^\/]+)?\/([^\/]+)/ ) ) {
        return null;
    }
    
    return RegExp.$1;
} // end of get_screen_name_from_url()


function parse_individual_tweet_url( tweet_url ) {
    if ( ! tweet_url ) {
        tweet_url = location.href;
    }
    
    try {
        tweet_url = new URL( tweet_url, d.baseURI ).href;
    }
    catch( error ) {
        tweet_url = '';
    }
    
    if ( ! tweet_url.match( /^(?:https?:\/\/[^\/]+)?\/([^\/]+)\/status(?:es)?\/(\d+)/ ) ) {
        return null;
    }
    
    return {
        screen_name : RegExp.$1,
        tweet_id : RegExp.$2,
        tweet_url : tweet_url
    };
} // end of parse_individual_tweet_url()


function api_get_csrf_token() {
    var csrf_token;
    
    try {
        csrf_token = document.cookie.match( /ct0=(.*?)(?:;|$)/ )[ 1 ];
    }
    catch ( error ) {
    }
    
    return csrf_token;
} // end of api_get_csrf_token()


function fetch_user_timeline( user_id, max_id, count ) {
    var api_url = API_USER_TIMELINE_TEMPLATE.replace( /#USER_ID#/g, user_id ).replace( /#COUNT#/g, ( count ? count : 20 ) ) + ( ( max_id && /^\d+$/.test( max_id ) ) ? '&max_id=' + max_id : '' );
    
    return fetch( api_url, {
        method : 'GET',
        headers : {
            'authorization' : 'Bearer ' + API_AUTHORIZATION_BEARER,
            'x-csrf-token' : api_get_csrf_token(),
            'x-twitter-active-user' : 'yes',
            'x-twitter-auth-type' : 'OAuth2Session',
            'x-twitter-client-language' : LANGUAGE,
        },
        mode: 'cors',
        credentials: 'include',
    } );
} // end of fetch_user_timeline()


var open_child_window = ( () => {
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
                log_error( error );
            }
        }
        
        if ( child_window ) {
            if ( child_window.name != name ) {
                child_window.name = name;
            }
            if ( child_window.location.href != url ) {
                child_window.location.href = url;
            }
        }
        else {
            child_window = w.open( url, name );
        }
        
        return child_window;
    };
} )(); // end of open_child_window()


var get_shortcut_keys = ( () => {
    var shortcut_keys = null;
    
    return () => {
        if ( shortcut_keys ) {
            return shortcut_keys;
        }
        
        try {
            shortcut_keys = JSON.parse( $( 'div[data-at-shortcutkeys]' ).attr( 'data-at-shortcutkeys' ) );
        }
        catch ( error ) {
            shortcut_keys = null;
            return {};
        }
        return shortcut_keys;
    };
} )(); // end of get_shortcut_keys()


function get_event_element_from_title( title ) {
    // TODO: https://twitter.com/i/timeline のページ種別（「リツイートされました」「いいねされました」等）判別が困難（多国語対応のため）
    // →暫定的に、キーボードショートカットを元に、document.title に一致するものを探して判別
    // → /2/notifications/all.json で取得された title が document.title のものと一致するかによってイベント種別を判別できるようになったため、get_event_element_from_title() は現状未使用
    
    if ( ! title ) {
        title = d.title;
    }
    
    var retweet_string = get_shortcut_keys()[ 't' ],
        like_string = get_shortcut_keys()[ 'l' ];
    
    if ( ( ! retweet_string ) || ( ! like_string ) ) {
        return 'unknown_event';
    }
    
    if ( title.match( retweet_string ) ) {
        return 'user_retweeted_tweet';
    }
    else if ( title.match( like_string ) ) {
        return 'user_liked_tweet';
    }
    else {
        return 'unknown_event';
    }
    
} // end of get_event_element_from_title()


function is_reacted_event_element( event_element ) {
    return /^users?_(retweet|like)/.test( event_element );
} // end of is_reacted_event_element()


function is_retweeted_event_element( event_element ) {
    return /^users?_retweet/.test( event_element );
} // end of is_retweeted_event_element()


function is_liked_event_element( event_element ) {
    return /^users?_like/.test( event_element );
} // end of is_liked_event_element()


function get_retweeter_link( $tweet ) {
    //return $tweet.find( 'a[role="link"]:not([href^="/i/"]):has(>span>span[dir="ltr"]>span)' ); // ←だと、自分自身がリツイートした場合に合致しない
    return $tweet.find( 'a[role="link"]:not([href^="/i/"]):has(>span>span)' );
} // end of get_retweeter_link()


function get_retweeter_screen_name( $tweet ) {
    return ( get_retweeter_link( $tweet ).attr( 'href' ) || '' ).replace( /^\//, '' );
} // end of get_retweeter_screen_name()


var open_search_window = ( () => {
    var user_timeline_url_template = 'https://twitter.com/#SCREEN_NAME#/with_replies?max_id=#MAX_ID#',
        search_query_template = 'from:#SCREEN_NAME# until:#GMT_DATETIME# include:retweets include:nativeretweets',
        search_url_template = 'https://twitter.com/search?f=live&q=#SEARCH_QUERY_ENCODED#';
    
    return ( search_parameters ) => {
        search_parameters = Object.assign( {}, search_parameters );
        
        var target_info = search_parameters.target_info,
            target_timestamp_ms = target_info.timestamp_ms,
            until_timestamp_ms = target_timestamp_ms + OPTIONS.HOUR_AFTER * 3601 * 1000,
            until_gmt_datetime = get_gmt_datetime( until_timestamp_ms, true ),
            search_query = search_query_template.replace( /#SCREEN_NAME#/g, target_info.screen_name ).replace( /#GMT_DATETIME#/g, until_gmt_datetime ),
            search_url = search_parameters.search_url = search_parameters.search_timeline_url = search_url_template.replace( /#SEARCH_QUERY_ENCODED#/g, encodeURIComponent( search_query ) ),
            test_tweet_id = ( target_info.id ) ? target_info.id : get_tweet_id_from_utc_sec( target_timestamp_ms / 1000.0 ),
            
            open_search_page = () => {
                open_child_window( search_parameters.search_url, {
                    search_parameters : search_parameters,
                } );
            };
        
        log_debug( 'search_parameters:', search_parameters, 'target_info:', target_info );
        log_debug( 'until_timestamp_ms:', until_timestamp_ms, 'until_gmt_datetime:', until_gmt_datetime );
        log_debug( 'search_url:', search_url );
        log_debug( 'test_tweet_id:', test_tweet_id );
        
        if ( ( ! search_parameters.use_user_timeline ) || ( ! test_tweet_id ) ) {
            open_search_page();
            return;
        }
        
        fetch_user_timeline( target_info.user_id, test_tweet_id )
        .then( response => response.json() )
        .then( ( json ) => {
            log_debug( 'fetch_user_timeline() json:', json );
            
            if ( ( ! Array.isArray( json ) ) || ( json.length <= 0 ) ) {
                open_search_page();
                return;
            }
            
            var until_tweet_id = get_tweet_id_from_utc_sec( until_timestamp_ms / 1000.0 ),
                max_id = new Decimal( until_tweet_id ).sub( 1 ).toString(),
                user_timeline_url = search_parameters.search_url = search_parameters.user_timeline_url = user_timeline_url_template.replace( /#SCREEN_NAME#/g, target_info.screen_name ).replace( /#MAX_ID#/g, max_id );
            
            log_debug( 'until_tweet_id:', until_tweet_id, 'max_id:', max_id );
            log_debug( 'user_timeline_url', user_timeline_url );
            
            open_search_page();
        } )
        .catch( ( error ) => {
            log_error( 'fetch_user_timeline() error:', error );
            open_search_page();
        } );
        
        // TODO: 現状別窓で https://twitter.com/search を開いて検索しており、
        // - 全てのツイートが対象となるとは限らない
        // - リツイートは一定期間以前のものは対象とならない
        // 問題あり
    };
} )(); // end of open_search_window()


var create_vicinity_link_container = ( function () {
    var $link_container_template = $( '<div><a></a></div>' ).addClass( VICINITY_LINK_CONTAINER_CLASS ),
        $link_template = $link_container_template.find( 'a:first' ).addClass( VICINITY_LINK_CLASS );
    
    return function ( options ) {
        options = ( options ) ? options : {};
        
        var tweet_url = options.tweet_url,
            tweet_url_info = parse_individual_tweet_url( tweet_url ) || {},
            act_screen_name = options.act_screen_name,
            class_name = options.class_name,
            title,
            text,
            css = options.css,
            attributes = options.attributes,
            $link_container = $link_container_template.clone( true ),
            $link = $link_container.find( 'a:first' );
        
        $link.attr( 'href', tweet_url );
        $link.attr( 'data-self_tweet_id', tweet_url_info.tweet_id );
        $link.attr( 'data-self_screen_name', tweet_url_info.screen_name );
        
        if ( act_screen_name ) {
            $link.attr( 'data-act_screen_name', act_screen_name );
            $link_container.addClass( ACT_CONTAINER_CLASS );
            title = OPTIONS.ACT_LINK_TITLE;
            text = OPTIONS.ACT_LINK_TEXT;
        }
        else {
            $link_container.addClass( SELF_CONTAINER_CLASS );
            title = OPTIONS.LINK_TITLE;
            text = OPTIONS.LINK_TEXT;
        }
        
        if ( class_name ) {
            $link_container.addClass( class_name );
        }
        if ( title ) {
            $link.attr( 'title', title );
        }
        if ( css ) {
            $link.css( css );
        }
        
        if ( attributes ) {
            $link.attr( attributes );
        }
        
        // TODO: 文字リンクの場合位置調整が難しい→アイコンリンク固定
        if ( true || OPTIONS.USE_LINK_ICON ) {
            $link_container.addClass( 'icon' );
            $link.text( ' ' );
        }
        else {
            $link_container.addClass( 'text' );
            
            if ( text ) {
                $link.text( text );
            }
        }
        
        $link.on( 'click', function ( event ) {
            event.stopPropagation();
            event.preventDefault();
            
            var act_screen_name = $link.attr( 'data-act_screen_name' ) || '',
                event_element = $link.attr( 'data-event_element' ) || '',
                tweet_id = $link.attr( 'data-self_tweet_id' ),
                reacted_tweet_info = get_reacted_tweet_info( tweet_id );
            
            if ( reacted_tweet_info.reacted_id ) {
                // リツイート／いいね情報は元ツイートに格納されているので差し替え
                // TODO: リツイートをいいねされた場合等は未対応
                tweet_id = reacted_tweet_info.reacted_id;
                reacted_tweet_info = get_reacted_tweet_info( tweet_id );
            }
            
            var reacted_info_map = ( is_retweeted_event_element( event_element ) ) ? reacted_tweet_info.rt_info_map : reacted_tweet_info.like_info_map,
                reacted_info = reacted_info_map.screen_name_map[ act_screen_name ] || {},
                target_info = {},
                search_parameters = {
                    use_user_timeline : ! ( OPTIONS.USE_SEARCH_TL_BY_DEFAULT ^ ( event.shiftKey || event.altKey || event.ctrlKey ) ),
                    act_screen_name : act_screen_name,
                    event_element : event_element,
                    reacted_tweet_info : reacted_tweet_info,
                    target_info : target_info,
                };
            
            if ( act_screen_name ) {
                Object.assign( target_info, reacted_info );
            }
            else {
                Object.assign( target_info, {
                    id : reacted_tweet_info.id,
                    screen_name : reacted_tweet_info.screen_name,
                    timestamp_ms : reacted_tweet_info.timestamp_ms,
                    user_id : reacted_tweet_info.user_id,
                    user_name :reacted_tweet_info.user_name,
                } );
            }
            
            open_search_window( search_parameters );
        } );
        
        return $link_container;
    };
} )(); // end of create_vicinity_link_container()


var create_recent_retweet_users_button = ( () => {
    var $recent_retweet_users_button_container_template = $( '<div><button class="btn"></button></div>' ).addClass( RECENT_RETWEETS_BUTTON_CLASS ).hide(),
        $recent_retweet_users_button_template = $recent_retweet_users_button_container_template.find( 'button:first' ).attr( {
            title : OPTIONS.RECENT_RETWEET_USERS_BUTTON_TITLE,
        } ).text( OPTIONS.RECENT_RETWEET_USERS_BUTTON_TEXT );
    
    return ( tweet_id ) => {
        var $recent_retweet_users_button_container = $recent_retweet_users_button_container_template.clone( true ),
            $recent_retweet_users_button = $recent_retweet_users_button_container.find( 'button:first' );
        
        $recent_retweet_users_button.attr( {
            'data-tweet-id' : tweet_id,
        } );
        
        $recent_retweet_users_button.on( 'click', function ( event ) {
            event.stopPropagation();
            event.preventDefault();
            
            // TODO: ＠＠＠ 制作中 ＠＠＠
            //recent_retweet_users_dialog.open( tweet_id );
            
            $recent_retweet_users_button.parents( 'article[role="article"]:first' ).click();
            
            return false;
        } );
        
        return $recent_retweet_users_button_container;
    };
} )(); // end of create_recent_retweet_users_button()


function add_vicinity_link_to_tweet( $tweet ) {
    var tweet_url = $tweet.find( 'a[role="link"][href^="/"][href*="/status/"]:has(time):first' ).attr( 'href' ),
        tweet_url_info = parse_individual_tweet_url( tweet_url ),
        $tweet_time,
        $tweet_caret,
        $action_list,
        tweet_id,
        screen_name,
        timestamp_ms,
        is_individual_tweet;
    
    if ( ! tweet_url_info ) {
        return false;
    }
    
    tweet_url = tweet_url_info.tweet_url;
    tweet_id = tweet_url_info.tweet_id;
    screen_name = tweet_url_info.screen_name;
    
    $tweet_time = $tweet.find( 'a[role="link"] time[datetime]:first' );
    
    is_individual_tweet = ( $tweet_time.length <= 0 );
    
    $tweet_caret = $tweet.find( '[data-testid="tweet"] [role="button"][data-testid="caret"]:first' );
    /*
    //$action_list = $tweet.find( 'div[dir="auto"]:has(>a[role="link"][href*="/help.twitter.com/"])' );
    //if ( $action_list.length <= 0 ) {
    //    $action_list = $tweet.find( 'div[role="group"]' );
    //}
    */
    $action_list = $tweet.find( 'div[role="group"]' );
    
    if ( is_individual_tweet ) {
        // TODO: 個別ツイートの場合、日付が取得しがたい（多国語対応のため）→ツイートIDから取得しているが、2010年11月以前は未対応
        try {
            timestamp_ms = tweet_id_to_date( tweet_id ).getTime();
        }
        catch ( error ) {
            timestamp_ms = '';
        }
    }
    else {
        timestamp_ms = new Date( $tweet_time.attr( 'datetime' ) ).getTime();
    }
    
    var $link_container = create_vicinity_link_container( {
            tweet_url : tweet_url,
            attributes : {
                'data-timestamp_ms' : timestamp_ms
            }
        } ),
        $link = $link_container.find( 'a:first' ),
        $link_container_bottom = $link_container.clone( true ),
        $link_bottom = $link_container_bottom.find( 'a:first' );
    
    if ( is_individual_tweet ) {
        // 個別ツイートへの追加
        
        // - 上部
        $link_container.addClass( 'large' ).css( {
        } );
        $link.css( {
            'margin-right' : '32px'
        } );
        $tweet_caret.before( $link_container );
        
        // - 下部
        $link_container_bottom.addClass( 'middle' ).css( {
            //'float' : 'left'
        } );
        $link_bottom.css( {
            'margin-top' : '16px',
            //'margin-right' : '16px'
            'margin-right' : '8px'
        } );
        $action_list.append( $link_container_bottom );
    }
    else {
        // タイムライン上ツイートへの追加
        
        // - 上部
        $link_container.addClass( 'middle' ).css( {
        } );
        $link.css( {
            'margin-right' : '32px'
        } );
        $tweet_time.parent().after( $link_container );
        
        /*
        // - 下部
        //$link_container_bottom.addClass( 'middle' ).css( {
        //} );
        //$link_bottom.css( {
        //    'margin-top' : '4px',
        //    'margin-right' : '16px'
        //} );
        //$action_list.append( $link_container_bottom );
        */
    }
    
    var $retweeter_link = get_retweeter_link( $tweet ),
        act_screen_name;
    
    if ( 0 < $retweeter_link.length ) {
        act_screen_name = ( $retweeter_link.attr( 'href' ) || '' ).replace( /^\//, '' );
        
        if ( act_screen_name ) {
            $link_container = create_vicinity_link_container( {
                tweet_url : tweet_url,
                act_screen_name : act_screen_name,
                attributes : {
                    'data-event_element' : 'user_retweeted_on_timeline',
                    'data-timestamp_ms' : timestamp_ms
                }
            } );
            
            $link = $link_container.find( 'a:first' );
            
            $link_container.addClass( 'middle' ).css( {
                'position' : 'absolute',
                'top' : '0',
                'left' : '4px'
            } );
            
            $link.css( {
                'margin-right' : '32px'
            } );
            
            $retweeter_link.parents( 'div:has(>div>svg):first' ).find( 'div:has(>svg)' ).append( $link_container );
        }
    }
    
    var $recent_retweet_users_button_container = create_recent_retweet_users_button( tweet_id ),
        $recent_retweet_users_button = $recent_retweet_users_button_container.find( 'button:first' ),
        $retweet_button = $action_list.find( 'div[data-testid="retweet"],div[data-testid="unretweet"]' );
    
    if ( is_individual_tweet ) {
        $recent_retweet_users_button.css( {
            'margin-top' : '14px',
        } );
    }
    $retweet_button.parent().after( $recent_retweet_users_button_container );
    
    return true;
} // end of add_vicinity_link_to_tweet()


function check_timeline_tweets() {
    var $tweets = $( 'div[data-testid="primaryColumn"] article[role="article"]:has(div[data-testid="tweet"]):not(:has(.' + VICINITY_LINK_CONTAINER_CLASS + '))' );
    
    $tweets = $tweets.filter( function ( index ) {
        var $tweet = $( this );
        
        return add_vicinity_link_to_tweet( $tweet );
    } );
    
    var $recent_retweet_users_button_containers = $( 'div[data-testid="primaryColumn"] article[role="article"] .' + RECENT_RETWEETS_BUTTON_CLASS + ':hidden' );
    
    $recent_retweet_users_button_containers.each( function () {
        var $recent_retweet_users_button_container = $( this ),
            $recent_retweet_users_button = $recent_retweet_users_button_container.find( 'button:first' ),
            tweet_url_info = parse_individual_tweet_url() || {},
            $ancestor = $recent_retweet_users_button_container.parents( 'article[role="article"]:first' ),
            retweet_number;
        
        if ( tweet_url_info.tweet_id == $recent_retweet_users_button.attr( 'data-tweet-id' ) ) {
            retweet_number = parseInt( $ancestor.find( 'a[href$="retweets"] span>span' ).text(), 10 );
        }
        else {
            retweet_number = parseInt( $ancestor.find( 'div[data-testid="retweet"] span>span, div[data-testid="unretweet"] span>span' ).text() );
        }
        
        if ( ! isNaN( retweet_number ) ) {
            //$recent_retweet_users_button_container.show();
        }
    } );
    
    return ( 0 < $tweets.length );
} // end of check_timeline_tweets()


var search_vicinity_tweet = ( () => {
    if ( ! is_search_mode() ) {
        return () => {};
    }
    
    var marked_class = SCRIPT_NAME + '_marked',
        reacted_tweet_info = SEARCH_PARAMETERS.reacted_tweet_info,
        target_info = SEARCH_PARAMETERS.target_info,
        threshold_timestamp_ms = ( () => {
            var threshold_timestamp_ms = target_info.timestamp_ms;
            
            if ( ! target_info.id ) {
                // TODO:リツイートやいいね等は、実際にアクションを起こしてから通知されるまで遅延がある
                // →通知時刻の一定時間前までを許容（ただし、ツイート時間以降）
                //threshold_timestamp_ms = Math.max( target_info.timestamp_ms - 60 * 1000, reacted_tweet_info.timestamp_ms );
                // →保留
            }
            return threshold_timestamp_ms;
        } )( ),
        
        ua = w.navigator.userAgent.toLowerCase(),
        animate_target_selector = ( ( ( ! w.chrome ) && ua.indexOf( 'webkit' ) != -1 ) || ( ua.indexOf( 'opr' ) != -1 ) || ( ua.indexOf( 'edge' ) != -1 ) ) ? 'body,html' : 'html',
        // [Javascript Chromeでページトップに戻る(scrollTop)が効かなくなってた件。 - かもメモ](http://chaika.hatenablog.com/entry/2017/09/22/090000)
        // ※ 2017/10現在 ($.fn.jquery = 3.1.1)
        //   'html' ← Firefox, Chrome, Vivaldi, IE
        //   'body' ← Safari, Opera, Edge
        animate_speed = 'fast', //  'slow', 'normal', 'fast' またはミリ秒単位の数値
        
        search_status = 'initialize', // 'initialize', 'wait_ready', 'search', 'found', 'stop', 'error'
        giveup_timerid = null,
        
        $primary_column = $(),
        $timeline = $(),
        $found_tweet_container = $(),
        
        found_tweet_info = {},
        
        adjust_scroll = ( $target ) => {
            var current_scroll_top = $( w ).scrollTop(),
                //to_scroll_top = $target.offset().top - ( $( w ).height() - $target.height() ) / 2;
                to_scroll_top = $target.offset().top - ( $( w ).height() / 2 );
            
            if ( ( to_scroll_top <= 0 ) || ( Math.abs( to_scroll_top - current_scroll_top ) < 20 ) ) {
                return true;
            }
            
            $( animate_target_selector ).animate( {
                scrollTop : to_scroll_top,
            }, animate_speed );
            
            return false;
        }, // end of adjust_scroll()
        
        search_tweet = () => {
            var is_itself = false,
                $found_tweet = $(),
                $tweet_links = $timeline.find( 'div:not(.' + marked_class + ') > article[role="article"] a[role="link"]:has(time[datetime])' ).filter( function () {
                    return parse_individual_tweet_url( $( this ).attr( 'href' ) );
                } ),
                $unrecognized_tweet_links = $tweet_links.filter( function () {
                    var tweet_id = parse_individual_tweet_url( $( this ).attr( 'href' ) ).tweet_id,
                        reacted_tweet_info = get_reacted_tweet_info( tweet_id );
                    
                    if ( ! reacted_tweet_info ) {
                        log_debug( 'reacted_tweet_info is not found: tweet_id=', tweet_id );
                    }
                    return ( ! reacted_tweet_info );
                } );
            
            if ( 0 < $unrecognized_tweet_links.length ) {
                log_debug( 'unrecognized', $unrecognized_tweet_links.length,  'link(s) found:', $unrecognized_tweet_links, 'reacted_tweet_info_map:', get_reacted_tweet_info_map() );
                
                // TODO: fetch データ取得のタイミングによっては get_reacted_tweet_info() でツイート情報が取得できない場合あり
                // →遅延させて再検索（このケースでは DOM 更新が走るとは限らないので setTimeout() で起動）
                setTimeout( () => {
                    search_vicinity_tweet();
                }, WAIT_DOM_REFRESH_MS );
                
                return $();
            }
            
            $tweet_links.each( function () {
                var $tweet_link = $( this ),
                    $tweet = $tweet_link.parents( 'article[role="article"]:first' ),
                    $tweet_container = $tweet.parent().addClass( marked_class ),
                    // ※ article[role="article"] は頻繁に書き換わることがあるため、比較的安定な parent() に class を設定
                    tweet_url_info = parse_individual_tweet_url( $tweet_link.attr( 'href' ) );
                
                if ( ! tweet_url_info ) {
                    return;
                }
                
                var current_tweet_id = tweet_url_info.tweet_id,
                    current_reacted_tweet_info = get_reacted_tweet_info( current_tweet_id ),
                    current_retweeter_screen_name = get_retweeter_screen_name( $tweet ),
                    current_reacted_info = ( current_retweeter_screen_name ) ? ( current_reacted_tweet_info.rt_info_map.screen_name_map[ current_retweeter_screen_name ] || current_reacted_tweet_info ) : current_reacted_tweet_info,
                    current_target_id = current_reacted_info.id,
                    current_timestamp_ms = current_reacted_info.timestamp_ms;
                
                if ( target_info.id ) {
                    if ( current_target_id == target_info.id ) {
                        is_itself = true;
                        $found_tweet = $tweet;
                        
                        return false;
                    }
                    
                    if ( bignum_cmp( current_target_id, target_info.id ) < 0 ) {
                        is_itself = false;
                        $found_tweet = $tweet;
                        
                        return false;
                    }
                }
                else {
                    if ( current_timestamp_ms <= threshold_timestamp_ms ) {
                        is_itself = ( current_tweet_id == reacted_tweet_info.id );
                        $found_tweet = $tweet;
                        
                        return false;
                    }
                    
                    if ( bignum_cmp( current_target_id, reacted_tweet_info.id ) < 0 ) {
                        is_itself = false;
                        $found_tweet = $tweet;
                        
                        return false;
                    }
                }
            } );
            
            if ( $found_tweet.length <= 0 ) {
                // 見つからなかった場合、強制スクロール
                $( animate_target_selector ).animate( {
                    //scrollTop : ( 0 < $tweet_links.length ) ? $tweet_links.last().offset().top : $( d ).height(),
                    scrollTop : $( d ).height(),
                }, animate_speed );
                
                return $();
            }
            
            var $found_tweet_container = $found_tweet.parent().addClass( ( is_itself ) ? TARGET_TWEET_CLASS : VICINITY_TWEET_CLASS ),
                // ※ article[role="article"] は頻繁に書き換わることがあるため、比較的安定な parent() に class を設定
                
                adjust_counter = MAX_ADJUST_SCROLL_NUMBER,
                adjust_acceptable_number = ADJUST_ACCEPTABLE_NUMBER,
                adjust_passed_number = 0,
                
                stop_adjust_handler = () => {
                    if ( adjust_timerid ) {
                        clearInterval( adjust_timerid );
                        adjust_timerid = null;
                    }
                    stop_cancel_handler();
                },
                
                adjust_timerid = setInterval( () => {
                    // ※タイムラインが表示しきれておらず目的ツイートを真ん中にもってこれなかった場合等のために時間をずらして再度スクロール
                    
                    if ( ( search_status == 'stop' ) || ( search_status == 'error' ) ) {
                        stop_adjust_handler();
                        return;
                    }
                    
                    adjust_counter --;
                    
                    if ( adjust_scroll( $found_tweet_container ) ) {
                        adjust_passed_number ++;
                    }
                    else {
                        adjust_passed_number = 0;
                    }
                    
                    log_debug( 'adjust_passed_number:', adjust_passed_number );
                    
                    if ( ( adjust_acceptable_number <= adjust_passed_number ) || ( adjust_counter <= 0 ) ) {
                        stop_adjust_handler();
                    }
                }, ADJUST_CHECK_INTERVAL_MS );
            
            found_tweet_info = {
                is_itself : is_itself,
                tweet_url : $found_tweet.find( 'a[role="link"]:has(time[datetime])' ).attr( 'href' ),
                retweeter_screen_name : get_retweeter_screen_name( $found_tweet ),
            };
            
            log_debug( '[target tweet was found] is_self:', is_itself, 'tweet:', $found_tweet, 'contaner:', $found_tweet_container );
            
            return $found_tweet_container;
        }, // end of search_tweet()
        
        update_found_tweet = () => {
            if ( 0 < $found_tweet_container.parents( 'section[role="region"]:first' ).length ) {
                return $found_tweet_container;
            }
            
            var $url_matched_tweets = $timeline.find( 'article[role="article"]:has(a[role="link"][href="' + found_tweet_info.tweet_url + '"] time[datetime])' );
            
            $url_matched_tweets.each( function () {
                var $tweet = $( this );
                
                if ( get_retweeter_screen_name( $tweet ) != found_tweet_info.retweeter_screen_name ) {
                    return;
                }
                
                $found_tweet_container = $tweet.parent().addClass( ( found_tweet_info.is_itself ) ? TARGET_TWEET_CLASS : VICINITY_TWEET_CLASS );
                return false;
            } );
            
            return $found_tweet_container;
        }, // end of update_found_tweet()
        
        start_giveup_handler = () => {
            giveup_timerid = ( ( previous_last_tweet_url ) => {
                return setInterval( () => {
                    var current_last_tweet_url = $timeline.find( 'article[role="article"] a[role="link"]:has(time[datetime]):last' ).attr( 'href' );
                    
                    if ( ( ! is_search_mode() ) || ( current_last_tweet_url == previous_last_tweet_url ) ) {
                        // 読み込まれたタイムラインの最後のツイートにいつまでも変化が無ければ諦める
                        // TODO: 検索にかからなかった場合（「結果なし」「検索結果と一致するものはありません。」）の判定が困難（多国語対応のため）
                        // → $timeline がいつまでも空のはずなので、タイムアウトでチェックする
                        stop_giveup_handler();
                        
                        log_error( '[give up scrolling] search_status:', search_status, '=> error' );
                        search_status = 'error';
                        return;
                    }
                    previous_last_tweet_url = current_last_tweet_url;
                }, 1000 * WAIT_BEFORE_GIVEUP_SCROLL_SEC );
            } )();
        }, // end of start_giveup_handler()
        
        stop_giveup_handler = () => {
            if ( giveup_timerid ) {
                clearInterval( giveup_timerid );
                giveup_timerid = null;
            }
        }, // end of stop_giveup_handler()
        
        start_cancel_handler = () => {
            $( d.body ).off( 'click.search_tweet' ).on( 'click.search_tweet', function ( event ) {
                event.stopPropagation();
                event.preventDefault();
                
                stop_giveup_handler();
                stop_cancel_handler();
                
                log_info( '[stop searching] canceled by user operation:', search_status, '=> stop' );
                search_status = 'stop';
            } );
        }, // end of start_cancel_handler()
        
        stop_cancel_handler = () => {
            $( d.body ).off( 'click.search_tweet' );
        }; // end of stop_cancel_handler()
    
    return () => {
        if ( ! is_search_mode() ) {
            return;
        }
        
        switch ( search_status ) {
            case 'error' :
                return;
            
            case 'stop' :
                return;
            
            case 'initialize' :
                $primary_column = $( 'div[data-testid="primaryColumn"]' );
                if ( $primary_column.length <= 0 ) {
                    return;
                }
                
                start_giveup_handler();
                
                $timeline = $primary_column.find( 'section[role="region"]' );
                
                if ( 0 < $timeline.length ) {
                    start_cancel_handler();
                    search_status = 'search';
                }
                else {
                    search_status = 'wait_ready';
                }
                return;
            
            case 'wait_ready' :
                $timeline = $primary_column.find( 'section[role="region"]' );
                
                if ( 0 < $timeline.length ) {
                    start_cancel_handler();
                    search_status = 'search';
                }
                return;
            
            case 'search' :
                $found_tweet_container = search_tweet();
                
                if ( 0 < $found_tweet_container.length ) {
                    stop_giveup_handler();
                    //stop_cancel_handler(); // ここでは止めない（スクロール位置調整中にも止めたいため）
                    search_status = 'found';
                }
                return;
            
            case 'found' :
                $found_tweet_container = update_found_tweet();
                
                if ( $found_tweet_container.length <= 0 ) {
                    search_status = 'error';
                }
                return;
        }
    };
} )(); // end of search_vicinity_tweet()


function check_notification_timeline() {
    if ( ! /^https?:\/\/twitter\.com\/i\/timeline/.test( location.href ) ) {
        return;
    }
    
    var $tweets = $( 'div[data-testid="primaryColumn"] article[role="article"]:has(div[data-testid="tweet"])' ),
        $users = $( 'div[data-testId="primaryColumn"] div[data-testid="UserCell"]' );
    
    $users.each( function () {
        var $user = $( this ),
            $profile_image_link = $user.find( 'a[role="link"]:has(img[src*="/profile_images/"]):first' ),
            act_screen_name = ( $profile_image_link.attr( 'href' ) || '' ).replace( /^\//, '' );
        
        if ( ! act_screen_name ) {
            return;
        }
        
        $tweets.each( function () {
            var $tweet = $( this ),
                tweet_url = $tweet.find( 'a[role="link"][href^="/"][href*="/status/"]:has(time):first' ).attr( 'href' ),
                tweet_url_info = parse_individual_tweet_url( tweet_url );
            
            if ( ! tweet_url_info ) {
                return;
            }
            
            var tweet_id = tweet_url_info.tweet_id,
                screen_name = tweet_url_info.screen_name,
                reacted_tweet_info = get_reacted_tweet_info( tweet_id ),
                rt_info = reacted_tweet_info.rt_info_map.screen_name_map[ act_screen_name ],
                like_info = reacted_tweet_info.like_info_map.screen_name_map[ act_screen_name ],
                is_valid = ( () => {
                    if ( rt_info || like_info ) {
                        return true;
                    }
                    
                    return false;
                    
                    // TODO: リツイートをいいねされた場合等のチェック(保留中)
                    /*
                    //var retweeter_screen_name = get_retweeter_screen_name( $tweet );
                    //
                    //if ( ! retweeter_screen_name ) {
                    //    return false;
                    //}
                    //
                    //rt_info = reacted_tweet_info.rt_info_map.screen_name_map[ retweeter_screen_name ];
                    //
                    //if ( ( ! rt_info ) || ( ! rt_info.id ) ) {
                    //    rt_info = null;
                    //    return false;
                    //}
                    //
                    //tweet_id = rt_info.id;
                    //screen_name = rt_info.screen_name;
                    //
                    //tweet_url = new URL( '/' + screen_name + '/status/' + tweet_id, d.baseURI ).href;
                    //
                    //reacted_tweet_info = get_reacted_tweet_info( tweet_id );
                    //rt_info = reacted_tweet_info.rt_info_map.screen_name_map[ act_screen_name ];
                    //like_info = reacted_tweet_info.like_info_map.screen_name_map[ act_screen_name ];
                    //
                    //return ( rt_info || like_info );
                    */
                } )();
            
            if ( ! is_valid ) {
                return;
            }
            
            var timestamp_ms = new Date( $tweet.find( 'a[role="link"] time[datetime]:first' ).attr( 'datetime' ) ).getTime(),
                $link_container = $user.find( '.' + VICINITY_LINK_CONTAINER_CLASS ),
                $link;
            
            if ( $link_container.length <= 0 ) {
                $link_container = create_vicinity_link_container( {
                    tweet_url : tweet_url,
                    act_screen_name : act_screen_name,
                } );
                
                $link = $link_container.find( 'a:first' );
                
                $link_container.addClass( 'middle' ).css( {
                    /*
                    //'position' : 'absolute',
                    //'top' : '12px',
                    //'right' : '160px'
                    */
                } );
                
                //$profile_image_link.after( $link_container );
                $user.find( 'a[role="link"]:has(span>span):first' ).parent().after( $link_container );
            }
            else {
                $link = $link_container.find( 'a:first' );
            }
            
            // 一番最初の(最近反応した)ツイートの情報へ更新
            $link.attr( {
                'href' : tweet_url,
                'data-self_tweet_id' : tweet_id,
                'data-self_screen_name' : screen_name,
                'data-timestamp_ms' : timestamp_ms,
            } );
            
            // /2/notifications/all.json で取得された title が document.title のものと一致するかによってイベント種別を判別
            if ( ( rt_info || {} ).event_title && d.title.match( rt_info.event_title ) ) {
                $link.attr( 'data-event_element', rt_info.event_element );
            }
            else if ( ( like_info || {} ).event_title && d.title.match( like_info.event_title ) ) {
                $link.attr( 'data-event_element', like_info.event_element );
            }
            else {
                $link.attr( 'data-event_element', 'unknown_event' );
            }
            
            return false;
        } );
    } );
    
} // end of check_notification_timeline()


function check_error_page() {
    if ( ! is_error_page() ) {
        return false;
    }
    
    var tweet_url = location.href,
        tweet_url_info = parse_individual_tweet_url( tweet_url ),
        $vicinity_link_containers = $( 'div[data-testid="primaryColumn"] .' + VICINITY_LINK_CONTAINER_CLASS ),
        timestamp_ms;
    
    if ( ! tweet_url_info || ( 0 < $vicinity_link_containers.length ) ) {
        return true; // エラーページの場合はそれ以降のチェックはしない
    }
    
    // TODO: 個別ツイートの場合、日付が取得できない→ツイートIDから取得しているが、2010年11月以前は未対応
    try {
        timestamp_ms = tweet_id_to_date( tweet_url_info.tweet_id ).getTime();
    }
    catch ( error ) {
        timestamp_ms = '';
    }
    
    var $link_container = create_vicinity_link_container( {
            tweet_url : tweet_url,
            class_name : [ 'large' ],
            attributes : {
                'data-timestamp_ms' : timestamp_ms
            }
        } ),
        $parent = $( 'div[data-testid="primaryColumn"] h1[role="heading"][data-testid="error-detail"]:first' );
    
    $parent.append( $link_container );
    
    return true;

} // end of check_error_page()


//{ ユーザーアクションイベントデータ取得関連
//  TODO: ユーザーアクション→HTTP Requestまで時間がかかるため、リアルタイム取得は困難
//  →現状未使用
var [
        analyze_client_event,
        get_last_client_event,
        get_client_event_log_list,
] = ( () => {
    var client_event_log_list = [],
        max_client_event_log_number = 100,
        
        reg_client_event_url = /^\/1\.1\/jot\/client_event\.json/;
    
    function analyze_client_event( url, request_body ) {
        var url_path = new URL( url ).pathname;
        
        if ( ! reg_client_event_url.test( url_path ) ) {
            return;
        }
        
        if ( ( ! ( request_body || '' ).match( /(?:^|&)log=(.+?)(?:&|$)/ ) ) ) {
            return;
        }
        
        var log_list = JSON.parse( decodeURIComponent( RegExp.$1 ) ),
            click_event_log_list = log_list.filter( ( log ) => {
                return ( ( ! isNaN( log.client_event_sequence_number ) ) && log.event_namespace && ( ( log._category_ == 'click_event' ) || ( log.event_namespace.action == 'navigate' ||  log.event_namespace.action == 'click' ) ) );
            } );
        
        client_event_log_list = client_event_log_list.concat( click_event_log_list ).slice( -max_client_event_log_number );
    } // end of analyze_client_event()
    
    
    function get_last_client_event( action ) {
        if ( ! action ) {
            return client_event_log_list.slice( -1 )[ 0 ];
        }
        
        return client_event_log_list.slice( 0 ).reverse().find( log => ( log.event_namespace && ( log.event_namespace.action == action ) ) );
    } // end of get_last_client_event()
    
    
    function get_client_event_log_list() {
        return client_event_log_list;
    } // end of get_client_event_log_list()
    
    return [
        analyze_client_event,
        get_last_client_event,
        get_client_event_log_list,
    ];
} )();
//}

//{ Twitter API 応答取得処理関連
var [
    analyze_capture_result,
    get_reacted_tweet_info,
    get_reacted_tweet_info_map,
] = ( () => {
    var reg_api_2 = /^\/2\//,
        reg_home_timeline_url = /^\/2\/timeline\/home\.json/,
        reg_conversation_url = /^\/2\/timeline\/conversation\/(\d+)\.json/,
        reg_user_timeline_url = /^\/2\/timeline\/(profile|media|favorites)\/(\d+)\.json/,
        reg_search_url = /^\/2\/search\/adaptive\.json/,
        reg_bookmark_timeline_url = /^\/2\/timeline\/bookmark.json/,
        reg_notification_all_url = /^\/2\/notifications\/all\.json/,
        reg_notification_view_url = /^\/2\/notifications\/view\/([^\/]+)\.json/,
        
        reg_capture_url_list = [
            reg_api_2,
        ],
        
        tweet_info_map = {},
        notification_info_map = {};
    
    function analyze_capture_result( url, json ) {
        var url_path = new URL( url ).pathname,
            globalObjects = ( json || {} ).globalObjects;
        
        if ( ( ! reg_capture_url_list.some( reg_capture_url => reg_capture_url.test( url_path ) ) ) || ( ! globalObjects ) ) {
            return;
        }
        
        var timeline = json.timeline,
            tweets = globalObjects.tweets,
            users = globalObjects.users,
            notifications = globalObjects.notifications,
            
            get_tweet_info = ( tweet_id ) => {
                var tweet = tweets[ tweet_id ],
                    tweet_info = tweet_info_map[ tweet_id ] = tweet_info_map[ tweet_id ] || {
                        rt_info_map : { tweet_id_map : {}, user_id_map : {}, screen_name_map : {} },
                        like_info_map : { user_id_map : {}, screen_name_map : {} },
                    },
                    user_id = tweet.user_id_str,
                    user = users[ user_id ];
                
                Object.assign( tweet_info, {
                    id : tweet_id,
                    user_id : user_id,
                    screen_name : user.screen_name,
                    user_name : user.name,
                    timestamp_ms : Date.parse( tweet.created_at ),
                    reacted_id : tweet.retweeted_status_id_str,
                } );
                
                return tweet_info;
            },
            
            get_add_entries = () => {
                try {
                    return ( ( timeline && timeline.instructions ) || [] ).filter( ( instruction ) => instruction.addEntries )[ 0 ].addEntries.entries;
                }
                catch ( error ) {
                    return [];
                }
            },
            
            update_tweet_info = () => {
                if ( ( ! tweets ) || ( ! users ) ) {
                    return;
                }
                var update = ( tweet ) => {
                    var tweet_id = tweet.id_str,
                        tweet_info = get_tweet_info( tweet_id ),
                        reacted_id = tweet_info.reacted_id;
                    
                    if ( ! reacted_id ) {
                        return;
                    }
                    
                    var retweeted_tweet_info = get_tweet_info( reacted_id ),
                        user_id = tweet_info.user_id,
                        screen_name = tweet_info.screen_name,
                        rt_info = {
                            id : tweet_id,
                            user_id : user_id,
                            screen_name : screen_name,
                            user_name : tweet_info.user_name,
                            timestamp_ms : tweet_info.timestamp_ms,
                        },
                        rt_info_map = retweeted_tweet_info.rt_info_map;
                    
                    rt_info_map.tweet_id_map[ tweet_id ] = rt_info_map.user_id_map[ user_id ] = rt_info_map.screen_name_map[ screen_name ] = rt_info;
                };
                
                for ( var [ key, tweet ] of Object.entries( tweets ) ) {
                    update( tweet );
                }
            }, // end of update_tweet_info()
            
            update_notification_info = () => {
                if ( ! reg_notification_all_url.test( new URL( url ).pathname ) ) {
                    return;
                }
                
                if ( ( ! tweets ) || ( ! users ) || ( ! notifications ) ) {
                    return;
                }
                
                var entries = get_add_entries();
                
                entries.forEach( ( entry ) => {
                    if ( ( ! entry.entryId ) || ( ! entry.entryId.match( /^notification-(.+)$/ ) ) ) {
                        return;
                    }
                    
                    var content = entry.content.item.content,
                        clientEventInfo = entry.content.item.clientEventInfo;
                    
                    if ( ! content.notification ) {
                        // content.tweet / clientEventInfo.element = 'user_replied_to_your_tweet' 等については未対応
                        return;
                    }
                    
                    var notification_id = content.notification.id, // ^notification-(.+)$ の数値部分と同じ
                        notification = notifications[ notification_id ],
                        event_element = clientEventInfo.element;
                    
                    if ( ( ! notification ) || ( ! is_reacted_event_element( event_element ) ) ) {
                        return;
                    }
                    
                    var notification_info = notification_info_map[ notification_id ] = notification_info_map[ notification_id ] || {},
                        event_title = content.notification.url.urtEndpointOptions.title,
                        timestamp_ms = 1 * notification.timestampMs, // 1 * entry.sortIndex と同じ
                        targetObjects = notification.template.aggregateUserActionsV1.targetObjects,
                        fromUsers = notification.template.aggregateUserActionsV1.fromUsers;
                    
                    Object.assign( notification_info, {
                        id : notification_id,
                        event_element : event_element,
                        timestamp_ms : timestamp_ms,
                        event_title : event_title, // https://twitter.com/i/timeline の [data-testid="primaryColumn"] h2[role="heading"] に入る
                        content : content,
                        clientEventInfo : clientEventInfo,
                        notification : notification,
                    } );
                    
                    targetObjects.forEach( ( targetObject ) => {
                        var tweet_id = targetObject.tweet.id,
                            reacted_tweet_info = get_reacted_tweet_info( tweet_id ),
                            reacted_info_map = ( is_retweeted_event_element( event_element ) ) ? reacted_tweet_info.rt_info_map : reacted_tweet_info.like_info_map;
                        
                        fromUsers.forEach( ( fromUser ) => {
                            var user_id = fromUser.user.id,
                                user = users[ user_id ],
                                screen_name = user.screen_name,
                                existing_reacted_info = reacted_info_map.user_id_map[ user_id ],
                                // 既存のものがある場合(個別ツイートのリツイート情報が既に得られている場合)、id(リツイートのステータスID) と timestamp_ms(リツイートの正確な時刻) は保持
                                reacted_info = {
                                    id : ( existing_reacted_info ) ? existing_reacted_info.id : '',
                                    user_id : user_id,
                                    screen_name : screen_name,
                                    user_name : user.name,
                                    timestamp_ms : ( existing_reacted_info && existing_reacted_info.timestamp_ms ) ? existing_reacted_info.timestamp_ms : timestamp_ms,
                                    event_element : event_element,
                                    event_title : event_title,
                                    notification_info : notification_info,
                                };
                            
                            reacted_info_map.user_id_map[ user_id ] = reacted_info_map.screen_name_map[ screen_name ] = reacted_info;
                        } );
                    } );
                } );
            }; // end of update_notification_info()
        
        update_tweet_info();
        update_notification_info();
        
    } // end of analyze_capture_result();
    
    
    function get_reacted_tweet_info( tweet_id ) {
        return tweet_info_map[ tweet_id ];
    } // end of get_reacted_tweet_info
    
    
    function get_reacted_tweet_info_map() {
        return tweet_info_map;
    } // end of get_reacted_tweet_info_map()
    
    return [
        analyze_capture_result,
        get_reacted_tweet_info,
        get_reacted_tweet_info_map,
    ];
} )();
//}


function analyze_fetch_data( message ) {
    switch ( message.message_id ) {
        case 'FETCH_REQUEST_DATA' :
            try {
                analyze_client_event( message.url, message.data.body );
            }
            catch ( error ) {
                log_error( 'analyze_client_event()', error );
            }
            break;
        
        case 'FETCH_RESPONSE_DATA' :
            try {
                analyze_capture_result( message.url, message.data.json );
            }
            catch ( error ) {
                log_error( 'analyze_capture_result()', error );
            }
            break;
    }
} // end of analyze_fetch_data()


function start_key_observer() {
    // TODO: ＠＠＠ 制作中 ＠＠＠
/*
    function is_key_acceptable() {
        var $active_element = $( d.activeElement );
        
        if ( (
                ( ( $active_element.hasClass( 'tweet-box' ) ) || ( $active_element.attr( 'role' ) == 'textbox' ) || ( $active_element.attr( 'name' ) == 'tweet' ) ) &&
                ( $active_element.attr( 'contenteditable' ) == 'true' )
            ) ||
            ( $active_element.prop( 'tagName' ) == 'TEXTAREA' ) ||
            ( ( $active_element.prop( 'tagName' ) == 'INPUT' ) && ( $active_element.attr( 'type' ).toUpperCase() == 'TEXT' ) )
        ) {
            return false;
        }
        return true;
    } // end of is_key_acceptable()
    
    
    $( d.body )
    .on( 'keydown.main', function ( event ) {
        if ( recent_retweet_users_dialog.is_opened() ) {
            return;
        }
        
        if ( event.shiftKey || event.altKey || event.ctrlKey ) {
            return;
        }
        
        if ( ! is_key_acceptable() ) {
            return;
        }
        
        var key_code = event.keyCode;
        
        switch ( key_code ) {
            case OPTIONS.OPEN_LINK_KEYCODE :
                return search_and_click_button_on_stream_item( event, 'div.' + LINK_CONTAINER_CLASS + ' a' );
            
            case OPTIONS.OPEN_ACT_LINK_KEYCODE :
                return search_and_click_button_on_stream_item( event, 'div.' + ACT_CONTAINER_CLASS + ' a' );
            
            case OPTIONS.TOGGLE_RERT_DIALOG_KEYCODE :
                return search_and_click_button_on_stream_item( event, '.' + SCRIPT_NAME + '-recent-retweets-button button' );
        }
    } );
*/
} // end of start_key_observer()


function start_tweet_observer() {
    var tweet_container = d.body,
        fetch_wrapper_container = d.querySelector( '#' + SCRIPT_NAME + '_fetch-wrapper-container' ),
        
        on_change = ( records ) => {
            var result;
            
            performance.mark( 'm1' );
            update_display_mode();
            performance.mark( 'm2' );
            result = check_error_page();
            performance.mark( 'm3' );
            if ( result ) {
                return;
            }
            performance.mark( 'm4' );
            search_vicinity_tweet();
            performance.mark( 'm5' );
            check_timeline_tweets();
            performance.mark( 'm6' );
            check_notification_timeline();
            performance.mark( 'm7' );
        },
        
        observer = new MutationObserver( ( records ) => {
            performance.mark( 'ma1' );
            on_change( records );
            performance.mark( 'ma2' );
        } ),
        
        fetch_observer = new MutationObserver( ( records ) => {
            performance.mark( 'mb1' );
            on_change( records );
            performance.mark( 'mb2' );
        } );
    
    observer.observe( tweet_container, { childList : true, subtree : true } );
    
    if ( OPTIONS.OBSERVE_DOM_FETCH_DATA ) {
        fetch_observer.observe( fetch_wrapper_container, { childList : true, subtree : false } );
    }
} // end of start_tweet_observer()


function start_fetch_observer() {
    // window.XMLHttpRequest / window.fetch にパッチをあてて、Twitter クライアントの Web API コールの結果を取得・置換し、拡張機能側に送信
    
    // TODO: [Chrome 拡張機能では、HTTP Response Body を取得する汎用的な方法が用意されていない](https://stackoverflow.com/questions/10393638/chrome-extensions-other-ways-to-read-response-bodies-than-chrome-devtools-netw)
    // ※ chrome.webRequest.onCompleted では Response Headers は取得できても Body は取得できない
    // ※ chrome.devtools.network.onRequestFinished では、開発者ツールを開いていないと取得できない
    // → コンテンツに script を埋め込み、XMLHttpRequest / fetch にパッチをあてて取得
    var make_fetch_wrapper = ( OBSERVE_DOM_FETCH_DATA ) => {
            var container_dom_id = '##SCRIPT_NAME##_fetch-wrapper-container',
                request_dom_id = '##SCRIPT_NAME##_fetch-wrapper-request',
                result_dom_id = '##SCRIPT_NAME##_fetch-wrapper-result',
                
                message_id_map = {
                    [ request_dom_id ] : 'FETCH_REQUEST_DATA',
                    [ result_dom_id ] : 'FETCH_RESPONSE_DATA',
                },
                
                reg_api_url = /^https:\/\/api\.twitter\.com\//,
                
                request_reg_url_list = [
                    reg_api_url,
                ],
                
                result_reg_url_list = [
                    reg_api_url,
                ],
                
                write_data = ( () => {
                    var fetch_wrapper_container = document.createElement( 'div' );
                    
                    fetch_wrapper_container.id = container_dom_id;
                    document.documentElement.appendChild( fetch_wrapper_container );
                    
                    return ( data, data_dom_id, reg_url_list ) => {
                        var url = data.url;
                        
                        if ( ! reg_url_list.some( reg_url_filter => reg_url_filter.test( url ) ) ) {
                            return;
                        }
                        
                        window.postMessage( {
                            namespace : '##SCRIPT_NAME##',
                            message_id : message_id_map[ data_dom_id ],
                            url : url,
                            data : data,
                        }, location.origin );
                        
                        if ( ! OBSERVE_DOM_FETCH_DATA ) {
                            return;
                        }
                        
                        // TODO: クリック等のイベント発生から通知（/1.1/jot/client_event.json への送信）までが比較的遅い
                        // → クリックによるページ遷移後に通知されることもある（DOMツリー変化→通知発生の順だとうまく判定ができない場合がある）
                        // → 通知時に DOM 要素も挿入することで、MutationObserver に検知させる
                        var data_container = fetch_wrapper_container.querySelector( '#' + data_dom_id );
                        
                        if ( data_container ) {
                            data_container.remove();
                        }
                        data_container = document.createElement( 'input' );
                        data_container.id = data_dom_id;
                        data_container.type = 'hidden';
                        data_container.value = JSON.stringify( data );
                        data_container.setAttribute( 'date-api-url', data.url );
                        data_container.style.display = 'none';
                        fetch_wrapper_container.appendChild( data_container );
                    };
                } )(),
                
                write_request_data = ( request ) => {
                    write_data( request, request_dom_id, request_reg_url_list );
                },
                
                write_result_data = ( result ) => {
                    write_data( result, result_dom_id, result_reg_url_list );
                },
                
                [ url_filter_map, response_json_filter_map ] = ( () => {
                    var api_user_timeline_template = '##API_USER_TIMELINE_TEMPLATE##',
                        reg_api2_user_timeline_params = {
                            user_id : /\/profile\/(\d+)\.json/,
                            count : /[?&]count=(\d+)/,
                            cursor : /[?&]cursor=([^&]+)/,
                        },
                        reg_location_url_max_id = /[?&]max_id=(\d+)/,
                        reg_number = /^(\d+)$/,
                        
                        url_filter_map = {
                            'default' : null,
                            
                            'usertimeline_url_2_to_1.1' : ( source_url ) => {
                                var user_id = ( source_url.match( reg_api2_user_timeline_params.user_id ) || [ 0, '' ] )[ 1 ];
                                
                                if ( ! user_id ) {
                                    return source_url;
                                }
                                
                                var count = ( source_url.match( reg_api2_user_timeline_params.count ) || [ 0, '20' ] )[ 1 ],
                                    cursor = decodeURIComponent( ( source_url.match( reg_api2_user_timeline_params.cursor ) || [ 0, '' ] )[ 1 ] ),
                                    location_url_max_id = ( location.href.match( reg_location_url_max_id ) || [ 0, '' ] )[ 1 ],
                                    max_id = reg_number.test( cursor ) ? cursor : location_url_max_id,
                                    replaced_url = api_user_timeline_template.replace( /#USER_ID#/g, user_id ).replace( /#COUNT#/g, count ) + ( max_id ? '&max_id=' + max_id : '' );
                                
                                //console.log( 'url_filter(): source_url=', source_url, 'location.href=', location.href );
                                //console.log( 'user_id=', user_id, 'count=', count, 'cursor=', cursor, 'location_url_max_id=', location_url_max_id, 'max_id=', max_id );
                                //console.log( 'replaced_url=', replaced_url );
                                
                                return replaced_url;
                            },
                        },
                        
                        response_json_filter_map = {
                            'default' : null,
                            
                            'usertimeline_response_1.1_to_2' : ( source_json, source_url ) => {
                                //console.log( 'response_json_filter(): source_url=', source_url, 'source_json=', source_json );
                                
                                // /2/timeline/profile と /1.1/statuses/user_timeline とでは応答(JSON)の構造が異なるため、変換を行う
                                var user_id = ( source_url.match( reg_api2_user_timeline_params.user_id ) || [ 0, '' ] )[ 1 ];
                                
                                if ( ! user_id ) {
                                    console.error( 'response_json_filter(): user_id not found. source_url=', source_url );
                                    
                                    return source_json;
                                }
                                
                                var max_id = ( location.href.match( reg_location_url_max_id ) || [ 0, '9223372036854775806' ] )[ 1 ], // Tweet ID の最大値は 2^63-1 = 0x7fffffffffffffff = 9223372036854775807
                                    until_id = Decimal.add( max_id, 1 ).toString(),
                                    min_id_obj = new Decimal( max_id ),
                                    since_id,
                                    
                                    replaced_json = {
                                        globalObjects : {
                                            broadcasts : {},
                                            cards : {},
                                            media: {},
                                            moments : {},
                                            places : {},
                                            tweets : {},
                                            users : {},
                                        },
                                        timeline : {
                                            id : 'ProfileAll-' + user_id,
                                            instructions : [
                                                {
                                                    addEntries : {
                                                        entries : [],
                                                    }
                                                },
                                            ],
                                            responseObjects : {
                                                feedbackActions : {},
                                            },
                                        },
                                    },
                                    src_tweets = source_json,
                                    dst_tweets = replaced_json.globalObjects.tweets,
                                    dst_users = replaced_json.globalObjects.users,
                                    dst_entries = replaced_json.timeline.instructions[ 0 ].addEntries.entries;
                                
                                src_tweets.forEach( ( src_tweet ) => {
                                    var tweet_id = src_tweet.id_str,
                                        src_user = src_tweet.user,
                                        user_id = src_user.id_str,
                                        retweeted_status = src_tweet.retweeted_status,
                                        quoted_status = src_tweet.quoted_status;
                                    
                                    dst_tweets[ tweet_id ] = src_tweet;
                                    src_tweet.user_id_str = user_id;
                                    dst_users[ user_id ] = src_user;
                                    delete src_tweet.user;
                                    
                                    if ( retweeted_status ) {
                                        src_tweet.retweeted_status_id_str = retweeted_status.id_str;
                                        dst_tweets[ retweeted_status.id_str ] = retweeted_status;
                                        retweeted_status.user_id_str = retweeted_status.user.id_str;
                                        dst_users[ retweeted_status.user.id_str ] = retweeted_status.user;
                                        delete retweeted_status.user;
                                    }
                                    
                                    if ( quoted_status ) {
                                        src_tweet.quoted_status_id_str = quoted_status.id_str;
                                        dst_tweets[ quoted_status.id_str ] = quoted_status;
                                        quoted_status.user_id_str = quoted_status.user.id_str;
                                        dst_users[ quoted_status.user.id_str ] = quoted_status.user;
                                        delete quoted_status.user;
                                    }
                                    
                                    dst_entries.push( {
                                        content : {
                                            item : {
                                                content : {
                                                    tweet : {
                                                        displayType : 'Tweet',
                                                        id : tweet_id,
                                                    }
                                                }
                                            }
                                        },
                                        entryId : 'tweet-' + tweet_id,
                                        sortIndex : tweet_id,
                                        
                                    } );
                                    
                                    if ( min_id_obj.cmp( tweet_id ) > 0 ) {
                                        min_id_obj = new Decimal( tweet_id );
                                    }
                                } );
                                
                                since_id = min_id_obj.sub( 1 ).toString();
                                
                                dst_entries.push( {
                                    content : {
                                        operation : {
                                            cursor : {
                                                cursorType : 'Top',
                                                value : until_id, // TODO: cursor 値が適当でも大丈夫か不明
                                            }
                                        }
                                    },
                                    entryId : 'cursor-top-' + until_id,
                                    sortIndex : until_id,
                                } );
                                
                                dst_entries.push( {
                                    content : {
                                        operation : {
                                            cursor : {
                                                cursorType : 'Bottom',
                                                stopOnEmptyResponse : true,
                                                value : since_id, // TODO: cursor 値が適当でも大丈夫か不明
                                            }
                                        }
                                    },
                                    entryId : 'cursor-bottom-' + since_id,
                                    sortIndex : since_id,
                                } );
                                
                                //console.log( 'response_json_filter(): source_url=', source_url, 'replaced_json=', replaced_json );
                                
                                return replaced_json;
                            },
                        };
                    
                    return [ url_filter_map, response_json_filter_map ];
                } )(),
                
                default_filter_url_config = {
                    name : 'default',
                    reg_url : /^/,
                    url_filter : url_filter_map[ 'default' ],
                    response_json_filter : response_json_filter_map[ 'default' ],
                },
                
                filter_location_configs = [
                    {
                        name : 'usertimeline_for_searching',
                        reg_location_url : /^https:\/\/twitter\.com\/([^\/]+)\/with_replies.*?[?&]max_id=(\d+)/,
                        filter_url_configs : [
                            {
                                name : 'use_api1.1_instead_of_2',
                                reg_url : /^https:\/\/api\.twitter\.com\/2\/timeline\/profile\/\d+\.json/,
                                url_filter : url_filter_map[ 'usertimeline_url_2_to_1.1' ],
                                response_json_filter : response_json_filter_map[ 'usertimeline_response_1.1_to_2' ],
                            },
                        ],
                    },
                    {
                        name : 'default',
                        reg_location_url : /^/,
                        filter_url_configs : [],
                    },
                ],
                
                get_filter_url_config = ( called_url, location_url ) => {
                    var filter_url_config;
                        
                    
                    if ( ! location_url ) {
                        location_url = location.href;
                    }
                    
                    try {
                        filter_url_config = filter_location_configs.filter( config => config.reg_location_url.test( location_url ) )[ 0 ].filter_url_configs.filter( config => config.reg_url.test( called_url ) )[ 0 ];
                    }
                    catch ( error ) {
                    }
                    
                    if ( ! filter_url_config ) {
                        filter_url_config = default_filter_url_config;
                    }
                    
                    return filter_url_config;
                };
            
            // ◆ window.XMLHttpRequest へのパッチ
            // 参考: [javascript - How can I modify the XMLHttpRequest responsetext received by another function? - Stack Overflow](https://stackoverflow.com/questions/26447335/how-can-i-modify-the-xmlhttprequest-responsetext-received-by-another-function)
            ( ( original_XMLHttpRequest ) => {
                if ( typeof intercept_xhr_response != 'function' ) {
                    console.error( 'intercept_xhr_response() (in "scripts/intercept_xhr.js") is required.');
                    return;
                }
                
                filter_location_configs.forEach( ( filter_location_config ) => {
                    if ( ! filter_location_config.reg_location_url.test( location.href ) ) {
                        return;
                    }
                    
                    //console.log( 'filter_location_config:', filter_location_config );
                    
                    filter_location_config.filter_url_configs.forEach( ( filter_url_config ) => {
                        var reg_url = filter_url_config.reg_url,
                            url_filter = filter_url_config.url_filter,
                            response_json_filter = filter_url_config.response_json_filter,
                            response_filter = ( original_responseText, replaced_url, called_url ) => {
                                var filtered_responseText;
                                
                                try {
                                    filtered_responseText = JSON.stringify( response_json_filter( JSON.parse( original_responseText ), called_url ) );
                                }
                                catch ( error ) {
                                    filtered_responseText = original_responseText; // JSON 以外のデータはそのまま返す
                                }
                                
                                //console.log( 'filtered_responseText', filtered_responseText, '<= original_responseText', original_responseText );
                                return filtered_responseText;
                            };
                        
                        intercept_xhr_response( reg_url, url_filter, response_filter );
                        //console.log( 'intercept_xhr_response(', reg_url, url_filter, response_filter, ')' );
                    } );
                } );
                
                var original_prototype_send = original_XMLHttpRequest.prototype.send;
                
                original_XMLHttpRequest.prototype.send = function ( body ) {
                    var xhr = this,
                        called_url = xhr._called_url,
                        replaced_url = xhr._replaced_url,
                        user_onreadystatechange = xhr.onreadystatechange;
                    
                    // リクエストデータを拡張機能に送信
                    write_request_data( {
                        url : called_url,
                        body : body,
                    } );
                    //console.log( 'xhr.send(): body=', body, 'xhr=', xhr );
                    
                    xhr.onreadystatechange = function () {
                        var response_json;
                        
                        if ( xhr.readyState === 4 ) {
                            try {
                                response_json = JSON.parse( xhr.responseText );
                                
                                // レスポンスデータを拡張機能に送信
                                write_result_data( {
                                    url : called_url,
                                    json : response_json,
                                } );
                                //console.log( 'xhr.onreadystatechange(): response_json', response_json, 'xhr=', xhr );
                            }
                            catch ( error ) {
                                // 応答が JSON ではない場合は無視
                            }
                        }
                        
                        if ( typeof user_onreadystatechange == 'function' ) {
                            return user_onreadystatechange.apply( xhr, arguments );
                        }
                    };
                    
                    original_prototype_send.apply( xhr, arguments );
                };
            } )( window.XMLHttpRequest );
            
            // ◆ window.fetch へのパッチ
            ( ( original_fetch ) => {
                window.fetch = ( url, options ) => {
                    var fetch_promise,
                        called_url = url,
                        body = ( options || {} ).body,
                        filter_url_config;
                    
                    try {
                        filter_url_config = get_filter_url_config( url );
                        
                        if ( filter_url_config.name != 'default' ) {
                            url = filter_url_config.url_filter( url );
                        }
                    }
                    catch ( error ) {
                        console.error( 'fetch()', error, '=> check get_filter_url_config()' );
                    }
                    
                    // リクエストデータを拡張機能に送信
                    write_request_data( {
                        url : called_url,
                        body : body,
                    } );
                    
                    fetch_promise = original_fetch( url, options );
                    
                    return fetch_promise.then( ( response ) => {
                        var original_json_function = response.json;
                        
                        response.json = function () {
                            var json_promise = original_json_function.apply( response, arguments );
                            
                            if ( filter_url_config.name == 'default' ) {
                                return json_promise;
                            }
                            
                            return json_promise.then( ( original_json ) => {
                                var replaced_json;
                                
                                try {
                                    replaced_json = filter_url_config.response_json_filter( original_json, called_url );
                                    
                                    // レスポンスデータを拡張機能に送信
                                    write_result_data( {
                                        url : called_url,
                                        json : replaced_json,
                                    } );
                                    
                                    return replaced_json;
                                }
                                catch ( error ) {
                                    return original_json; // JSON 以外のデータはそのまま返す
                                }
                            } );
                        };
                        
                        return response;
                    } );
                };
            } )( window.fetch );
        },
        script = d.createElement( 'script' ),
        script_nonce = d.querySelector( 'script[nonce]' ),
        nonce = ( script_nonce ) ? script_nonce.getAttribute( 'nonce' ) : '';
    
    window.addEventListener( 'message', function ( event ) {
        if ( event.origin != location.origin ) {
            return;
        }
        
        var message = event.data;
        
        if ( ( ! message ) || ( message.namespace != SCRIPT_NAME ) ) {
            return;
        }
        
        analyze_fetch_data( message );
    } );
    
    script.textContent = '(' + make_fetch_wrapper.toString().replace( /##SCRIPT_NAME##/g, SCRIPT_NAME ).replace( /##API_USER_TIMELINE_TEMPLATE##/g, API_USER_TIMELINE_TEMPLATE ) + ')(' + OPTIONS.OBSERVE_DOM_FETCH_DATA +');';
    if ( nonce ) {
        script.setAttribute( 'nonce', nonce );
    }
    
    d.documentElement.appendChild( script );
    setTimeout( ( scripts ) => {
        script.remove();
    }, 1 );
} // end of start_fetch_observer()


function insert_css( css_rule_text ) {
    var parent = d.querySelector( 'head' ) || d.body || d.documentElement,
        css_style = d.createElement( 'style' ),
        css_rule = d.createTextNode( css_rule_text );
    
    css_style.type = 'text/css';
    css_style.className = SCRIPT_NAME + '-css-rule';
    
    if ( css_style.styleSheet ) {
        css_style.styleSheet.cssText = css_rule.nodeValue;
    }
    else {
        css_style.appendChild( css_rule );
    }
    
    parent.appendChild( css_style );
} // end of insert_css()


function set_user_css() {
    var night_mode_selector = 'body[data-nightmode="true"]',
        vicinity_link_container_selector = 'div.' + VICINITY_LINK_CONTAINER_CLASS,
        vicinity_link_container_self_selector = 'div.' + SELF_CONTAINER_CLASS,
        vicinity_link_container_act_selector = 'div.' + ACT_CONTAINER_CLASS,
        vicinity_link_selector = 'div > a.' + VICINITY_LINK_CLASS,
        vicinity_link_self_selector = vicinity_link_container_self_selector + ' > a.' + VICINITY_LINK_CLASS,
        vicinity_link_act_selector = vicinity_link_container_act_selector + ' > a.' + VICINITY_LINK_CLASS,
        recent_retweets_button_selector = 'div.' + RECENT_RETWEETS_BUTTON_CLASS + ' button.btn',
        target_tweet_selector = 'div.' + TARGET_TWEET_CLASS + ' > article',
        vicinity_tweet_selector = 'div.' + VICINITY_TWEET_CLASS + ' > article',
        
        css_rule_lines = [
            vicinity_link_selector + ' {' + [
                'display: inline-block',
                'margin: 0 0 0 8px',
                'padding: 0 0 0 0',
                'text-decoration: none',
                'font-size: 12px',
                'white-space: nowrap',
            ].join( '; ' ) + '}',
            
            vicinity_link_container_selector + '.icon a {' + [
                'width: 12px; height: 12px',
                'background-image: url(' + LINK_ICON_URL + ' )',
                'background-repeat: no-repeat',
                'background-position: 0 0',
                'background-size: 24px 12px',
            ].join( '; ' ) + '}',
            
            vicinity_link_container_selector + '.icon:hover a {' + [
                'background-position : -12px 0',
            ].join( '; ' ) + '}',
            
            vicinity_link_container_selector + '.text a {opacity: 0.8;}',
            vicinity_link_container_selector + '.text a:hover {opacity: 1.0;}',
            vicinity_link_container_selector + '.text a {padding: 2px 4px; opacity: 0.8; color: #004262; background-color: #ffffee;}',
            night_mode_selector + ' ' + vicinity_link_container_selector + '.text a {color: #ffffee; background-color: #004262;}',
            
            vicinity_link_container_selector + '.middle a {}',
            vicinity_link_container_selector + '.middle.icon a {transform: scale(1.5, 1.5);}',
            vicinity_link_container_selector + '.middle.text a {}',
            
            vicinity_link_container_selector + '.large a {transform: scale(2, 2);}',
            vicinity_link_container_selector + '.large.icon a {}',
            vicinity_link_container_selector + '.larget.text a {}',
            
            recent_retweets_button_selector + ' {font-size: 12px; font-weight: normal; padding: 2px 3px; text-decoration: none; cursor: pointer; display: inline-block;}',
            recent_retweets_button_selector + ' {margin-left: 8px; margin-right: 24px; background-image: linear-gradient(rgb(255, 255, 255), rgb(245, 248, 250)); background-color: rgb(245, 248, 250); color: rgb(102, 117, 127); cursor: pointer; display: inline-block; position: relative; border-width: 1px; border-style: solid; border-color: rgb(230, 236, 240); border-radius: 4px;}',
            recent_retweets_button_selector + ':hover {color: rgb(20, 23, 26); background-color: rgb(230, 236, 240); background-image: linear-gradient(rgb(255, 255, 255), rgb(230, 236, 240)); text-decoration: none; border-color: rgb(230, 236, 240);}',
            night_mode_selector + ' ' + recent_retweets_button_selector + ' {background-color: #182430; background-image: none; border: 1px solid #38444d; border-radius: 4px; color: #8899a6; display: inline-block;}',
            night_mode_selector + ' ' + recent_retweets_button_selector + ':hover {color: #fff; text-decoration: none; background-color: #10171e; background-image: none; border-color: #10171e;}',
            
            target_tweet_selector + ' {background-color: ' + OPTIONS.TARGET_TWEET_COLOR + ';}',
            vicinity_tweet_selector + ' {background-color: ' + OPTIONS.VICINITY_TWEET_COLOR + ';}',
            night_mode_selector + ' ' + target_tweet_selector + ' {background-color: ' + OPTIONS.TARGET_TWEET_COLOR_NIGHTMODE + ';}',
            night_mode_selector + ' ' + vicinity_tweet_selector + ' {background-color: ' + OPTIONS.VICINITY_TWEET_COLOR_NIGHTMODE + ';}',
        ];
    
    $( 'style.' + SCRIPT_NAME + '-css-rule' ).remove();
    
    insert_css( css_rule_lines.join( '\n' ) );

} // end of set_user_css()


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
    ID_BEFORE_LEGACY = Decimal.mul( ID_INC_PER_SEC_LEGACY, OPTIONS.HOUR_BEFORE * 3600 );
    ID_AFTER_LEGACY = Decimal.mul( ID_INC_PER_SEC_LEGACY, OPTIONS.HOUR_AFTER * 3600 );
    ID_THRESHOLD = new Decimal( ID_THRESHOLD );
    
    log_debug( 'ID_INC_PER_SEC =', ID_INC_PER_SEC.toString() );
    log_debug( 'ID_BEFORE =', ID_BEFORE.toString() );
    log_debug( 'ID_AFTER =', ID_AFTER.toString() );
    log_debug( 'ID_THRESHOLD =', ID_THRESHOLD.toString() );
    
    set_user_css();
    
    external_script_injection_ready( ( injected_scripts ) => {
        start_fetch_observer();
    } );
    start_tweet_observer();
    start_key_observer();
    
    /*
    //setTimeout( () => {
    //    var entries = [
    //        { name : 'tweet-onchange', from : 'ma1', to : 'ma2' },
    //        { name : 'fetch_tweet-onchange', from : 'mb1', to : 'mb2' },
    //        
    //        { name : 'update_display_mode()', from : 'm1', to : 'm2' },
    //        { name : 'check_error_page()', from : 'm2', to : 'm3' },
    //        { name : 'search_vicinity_tweet()', from : 'm4', to : 'm5' },
    //        { name : 'check_timeline_tweets()', from : 'm5', to : 'm6' },
    //        { name : 'check_notification_timeline()', from : 'm6', to : 'm7' },
    //    ];
    //    
    //    entries.forEach( ( entry ) => {
    //        try {
    //            performance.measure( entry.name, entry.from, entry.to );
    //            log_info( entry.name, performance.getEntriesByName( entry.name )[ 0 ].duration );
    //        }
    //        catch ( error ) {
    //        }
    //    } );
    //}, 60*1000 );
    */
    
    log_debug( 'All set.' );
} // end of initialize()


function main() {
    // ユーザーオプション読み込み
    w.twDisplayVicinity_chrome_init( function ( user_options ) {
        initialize( user_options );
    } );
} // end of main()

//}

main(); // エントリポイント

} )( window, document );
