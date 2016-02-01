// ==UserScript==
// @name            twDisplayVicinity
// @namespace       http://d.hatena.ne.jp/furyu-tei
// @author          furyu
// @version         0.2.4.1
// @include         http://twitter.com/*
// @include         https://twitter.com/*
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

if ( w !== w.parent ) {
    return;
}

function main( w, d ) {
    //{ ■ パラメータ
    var OPTIONS = {
        USE_SEARCH_TL_BY_DEFAULT : false
        
    ,   HOUR_BEFORE : 24
    ,   HOUR_AFTER : 8
        
    ,   TARGET_TWEET_COLOR : 'gold'
    ,   VICINITY_TWEET_COLOR : 'pink'
    ,   LINK_COLOR : 'darkblue'
    ,   ACT_LINK_COLOR : 'indigo'
        
    ,   HIDE_NEWER_TWEETS : true
    ,   DAY_BEFORE : 1
    ,   DAY_AFTER : 1
    
    ,   USE_LINK_ICON : true
    };
    //}
    
    
    //{ ■ 共通変数
    var NAME_SCRIPT = 'twDisplayVicinity',
        DEBUG = false,
        $ = w.jQuery,
        form_404 = d.querySelector( 'form.search-404' ),
        is_page_404 = !! form_404;
    
    //{ check environment
    if ( w[ NAME_SCRIPT + '_touched' ] ) {
        return;
    }
    
    if ( ! $ ) {
        if ( ! d.getElementById( NAME_SCRIPT+'_jq' ) ) {
            if ( is_page_404 ) {
                var script = d.createElement( 'script' ),
                    src = localStorage[ NAME_SCRIPT + '_jq_src' ];
                
                script.id = NAME_SCRIPT + '_jq';
                //script.src='//ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.min.js';
                // ※ 2014/07/28: 外部スクリプトに制限がかけられた模様
                //  (Google Chrome)
                //    Refused to load the script 'https://ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.min.js'
                //    because it violates the following Content Security Policy directive: "script-src chrome-extension://*** 'unsafe-inline' 'unsafe-eval' https://abs.twimg.com https://ssl.google-analytics.com about:".
                if ( ! src ) {
                    src = 'https://abs.twimg.com/c/swift/ja/init.8df987bce4686cb01cbf3449b332e646fce9d6cc.js';
                }
                script.src = src;
                d.documentElement.appendChild( script );
            }
        }
        setTimeout( function (){
            main( w, d );
        }, 100);
        
        return;
    }
    
    w[ NAME_SCRIPT + '_touched' ] = true;
    
    var jq_script = $( 'script[src*="//abs.twimg.com/"][src*="/init."]:first' );
    if ( 0 < jq_script.size() ) {
        localStorage[ NAME_SCRIPT + '_jq_src' ] = jq_script.attr( 'src' );
    }
    //} end of check environment
    
    var LANGUAGE = ( function () {
        try {
            return ( w.navigator.browserLanguage || w.navigator.language || w.navigator.userLanguage ).substr( 0, 2 );
        }
        catch ( error ) {
            return 'en';
        }
    } )();
    
    switch ( LANGUAGE ) {
        case 'ja' :
            OPTIONS.LINK_TEXT = '\u8fd1\u508d'; // "近傍"
            OPTIONS.LINK_TITLE = '\u8fd1\u508d\u30c4\u30a4\u30fc\u30c8\u8868\u793a'; // "近傍ツイート表示"
            OPTIONS.ACT_LINK_TEXT = '\u8fd1\u508d'; // "近傍"
            OPTIONS.ACT_LINK_TITLE = '\u30a2\u30af\u30b7\u30e7\u30f3\u306e\u8fd1\u508d\u30c4\u30a4\u30fc\u30c8\u8868\u793a'; // "アクションの近傍ツイート表示"
            break;
        default:
            OPTIONS.LINK_TEXT = 'vicinity';
            OPTIONS.LINK_TITLE = 'search vicinity tweets';
            OPTIONS.ACT_LINK_TEXT = 'vicinity';
            OPTIONS.ACT_LINK_TITLE = 'search vicinity tweets around action';
            break;
    }
    
    var user_options = w.twDisplayVicinity_Options;
    if ( user_options ) {
        for ( var name in user_options ) {
            if ( ! ( user_options.hasOwnProperty( name ) ) || ( user_options[ name ] === null ) ) {
                continue;
            }
            OPTIONS[ name ] = user_options[ name ];
        }
    }
    
    var API_SEARCH = 'https://twitter.com/search',
        API_TIMELINE_BASE = 'https://twitter.com/',
        
        LINK_ID_PREFIX = NAME_SCRIPT + '_link_',
        
        LINK_CONTAINER_CLASS = NAME_SCRIPT + '_link_container',
        ACT_CONTAINER_CLASS = NAME_SCRIPT + '_act_container',
        
        CONTAINER_CLASS_LIST = [ LINK_CONTAINER_CLASS, ACT_CONTAINER_CLASS ],
        
        LINK_DICT = {},
        LINK_ID_NUM = 1,
        
        INTV_CHECK_MS = 300, // チェック間隔(単位：ms)
        MAX_CHECK_RETRY = 10, // 'div.stream-end' 要素が表示されてから、チェックを終了するまでのリトライ回数(タイミングにより、いったん表示されてもまた消える場合がある)
        WAIT_BEFORE_GIVEUP_SCROLL_SEC = 10, // 強制スクロールさせてタイムラインの続きを読み込む際に、いつまでも変化が見られず、諦めるまでの時間(単位:秒)
        
        ID_INC_PER_SEC = 1000 * ( 0x01 << 22 ),
        SEC_BEFORE = OPTIONS.HOUR_BEFORE * 3600,
        SEC_AFTER = OPTIONS.HOUR_AFTER * 3600,
        TWEPOCH_MSEC = 1288834974657,
        TWEPOCH = ~~( TWEPOCH_MSEC / 1000 ), // 1288834974.657 sec (2011.11.04 01:42:54(UTC)) (via http://www.slideshare.net/pfi/id-15755280)
        ID_THRESHOLD = '300000000000000', // 2010.11.04 22時(UTC)頃に、IDが 30000000000以下から300000000000000以上に切り替え
        ID_BEFORE = null,
        ID_AFTER = null,
        
        LINK_ICON_URL = [ // アイコン(48×48)
            'data:image/gif;base64,'
        ,   'R0lGODlhYAAwAKECAP+WE6q4wv///////yH5BAEKAAIALAAAAABgADAAQAL+lI+pi+HBopwKWEDz'
        ,   'fLx7p2nXSJZWiDZdyi7l9kEGd8Tg/NSxeRrjwesJfj4ejNZKFonKjM3WZASD0ariebNGpkKtxOMN'
        ,   'vcLOFZkyToLPkzQbhzWHuaY3/GNPTPPWGF9fxxeHdEbH5DWI52UYaLf2h+AGKfA4OURy5JcQd3dj'
        ,   'w1UBekkUBEVpxrn5RDV6scQaufclZykJWTlpS5aIG8WoW5WYxzjZ+wdsGWLMh8z2lAvrODhs+Mab'
        ,   'Q/brGnZNaKV92NddCP63TB1+Swudbr4O2Wz9fow52/18ivQJLjpWanoF35p9RlzI8sfD1EB8AXcU'
        ,   'RBgtVkJNC+8RhLiNn6gyCOfsxHM2j1m9ZB3ffDxTks3JJhZlaNGIAZHFORpR8jL5K08qdBGlpaS5'
        ,   'khu2ZK/eFAAAOw=='
        ].join( '' );
        
    //} end of global variables
    
    
    //{ ■ 関数
    var log = w.log = ( function () {
        return function ( str ) {
            // ※ console.log() 等は、Twitter側で無効化されてしまう
            console.error( str );
        };
    } )(); // end of log()
    
    
    var log_debug = ( function () {
        if ( ! DEBUG ) {
            return function () {
            };
        }
        return function ( str ) {
            log( NAME_SCRIPT + ' [' + ( new Date().toISOString() ) + '] ' + str );
        };
    } )(); // end of log_debug()
    
    
    var BigNum = ( function () {
        var DIGIT_UNIT_LEN = 7,
            DIV_UNIT = Math.pow( 10, DIGIT_UNIT_LEN );
        
        function get_zero_info() {
            return { sign : 0, digit_list : [ 0 ] }
        }
        
        var zero_pad = ( function () {
            var zero_str = new Array( DIGIT_UNIT_LEN ).join( '0' );
            
            return function ( num, len ) {
                if ( !len ) {
                    len = DIGIT_UNIT_LEN;
                }
                if ( num.length == len ) {
                    return num;
                }
                if ( len == DIGIT_UNIT_LEN ) {
                    return ( zero_str + num ).slice( -len );
                }
                return ( new Array( len ).join( '0' ) + num ).slice( -len );
            };
        } )();
        
        var get_digit_info = ( function () {
            var re_digit = /^\s*([+\-]?)0*(\d+)\s*$/;
            
            return function ( num ) {
                if ( ! ( '' + num ).match( re_digit ) ) {
                    return get_zero_info();
                }
                if ( RegExp.$2 == '0' ) {
                    return get_zero_info();
                }
                var sign = ( RegExp.$1 == '-' ) ? -1 : 1,
                    digit_str = RegExp.$2,
                    digit_list = [];
                
                for ( var pos = digit_str.length; 0 < pos; pos -= DIGIT_UNIT_LEN ) {
                    digit_list.push( parseInt( digit_str.slice( ( pos < DIGIT_UNIT_LEN ) ? 0 : ( pos - DIGIT_UNIT_LEN ), pos ) ) );
                }
                return { sign : sign, digit_list : digit_list };
            };
        } )();
        
        function get_digit_str( sign, digit_list ) {
            if ( ! sign ) {
                return '0';
            }
            var digit_str_list = [],
                pos = digit_list.length - 1;
            
            digit_str_list.push( digit_list[ pos -- ] );
            for ( ; 0 <= pos; pos -- ) {
                digit_str_list.push( zero_pad( digit_list[ pos ] ) );
            }
            return ( ( sign < 0 ) ? '-' : '' ) + digit_str_list.join( '' );
        }
        
        function add_digit_list( x_info, y_info ) {
            var x_sign = x_info.sign,
                x_digit_list = x_info.digit_list,
                xlen = x_digit_list.length,
                
                y_sign = y_info.sign,
                y_digit_list = y_info.digit_list,
                ylen = y_digit_list.length,
                
                z_sign = 0,
                z_digit_list = [],
                
                cx,
                cy,
                cz = 0,
                cs = 0;
            
            for ( var pos = 0, len = Math.max( xlen, ylen ); pos < len; pos ++ ) {
                cx = ( pos < xlen ) ? x_digit_list[ pos ] : 0;
                cy = ( pos < ylen ) ? y_digit_list[ pos ] : 0;
                cx = x_sign * cx;
                cy = y_sign * cy;
                cz += ( cx + cy );
                cs = ( ( x_sign * cz ) < 0 ) ? ( x_sign * DIV_UNIT ) : 0;
                cz += cs;
                if ( cz ) {
                    z_sign = ( cz < 0 ) ? -1 : 1;
                }
                z_digit_list.push( z_sign * ( cz % DIV_UNIT ) );
                cz = ~~( cz / DIV_UNIT ) - ~~( cs / DIV_UNIT );
            }
            if ( 1 <= Math.abs( cz ) ) {
                z_digit_list.push( cz );
            }
            return { sign : z_sign, digit_list : z_digit_list };
        }
        
        function mul_digit_list( x_info, y_info ) {
            var x_sign = x_info.sign,
                x_digit_list = x_info.digit_list,
                xlen = x_digit_list.length,
                
                y_sign = y_info.sign,
                y_digit_list = y_info.digit_list,
                ylen = y_digit_list.length,
                
                z_sign = x_sign * y_sign,
                zlen = xlen + ylen + 1,
                z_digit_list = new Array( zlen ),
                
                cx,
                cy,
                cz;
            
            for ( var zpos = 0; zpos < zlen; zpos ++ ) {
                z_digit_list[ zpos ] = 0;
            }
            
            for ( var xpos = 0; xpos < xlen; xpos ++ ) {
                cx = x_digit_list[ xpos ];
                cz = 0;
                for ( var ypos = 0; ypos < ylen; ypos ++ ) {
                    cy = y_digit_list[ ypos ];
                    cz += ( z_digit_list[ xpos + ypos ] + ( cx * cy ) );
                    z_digit_list[ xpos + ypos ] = cz % DIV_UNIT;
                    cz = ~~( cz / DIV_UNIT );
                }
                z_digit_list[ xpos + ypos ] = cz;
            }
            for ( var zpos = zlen - 1; 0 < zpos; zpos -- ) {
                if ( z_digit_list[ zpos ] ) {
                    break;
                }
                z_digit_list.pop();
            }
            return { sign : z_sign, digit_list : z_digit_list };
        }
        
        function BigNum( num ) {
            if ( num instanceof BigNum ) {
                return num;
            }
            var self = this;
            
            if ( ! ( self instanceof BigNum ) ) {
                return new BigNum( num );
            }
            var digit_info = null,
                digit_str = null;
            
            self.get_num = function () {
                return num
            };
            
            self.set_num = function ( _num ) {
                num = _num;
                digit_info = get_digit_info( _num );
                digit_str = get_digit_str( digit_info.sign, digit_info.digit_list );
            };
            
            self.get_digit_info = function (){
                return digit_info
            };
            
            self.set_digit_info = function ( _digit_info ) {
                digit_info = _digit_info;
                num = digit_str = get_digit_str( digit_info.sign, digit_info.digit_list );
            };
            
            self.get_digit_str = function (){
                return digit_str;
            };
            
            if ( num.hasOwnProperty( 'sign' ) && num.hasOwnProperty( 'digit_list' ) ) {
                self.set_digit_info( num );
            }
            else {
                self.set_num( num );
            }
        }
        
        BigNum.cmp_abs = function ( x, y ) {
            x = BigNum( x );
            y = BigNum( y );
            
            var x_digit_list = x.get_digit_info().digit_list,
                y_digit_list = y.get_digit_info().digit_list;
            
            if ( x_digit_list.length < y_digit_list.length ) {
                return -1;
            }
            if ( y_digit_list.length < x_digit_list.length ) {
                return 1;
            }
            for ( var pos = x_digit_list.length - 1; 0 <= pos; pos -- ) {
                if ( x_digit_list[ pos ] < y_digit_list[ pos ] ) {
                    return -1;
                }
                if ( y_digit_list[ pos ] < x_digit_list[ pos ] ) {
                    return 1;
                }
            }
            return 0;
        };
        
        BigNum.cmp = function ( x, y ) {
            x = BigNum( x );
            y = BigNum( y );
            var x_info = x.get_digit_info(),
                x_sign = x_info.sign,
                
                y_info = y.get_digit_info(),
                y_sign = y_info.sign;
            
            if ( x_sign < y_sign ) {
                return -1;
            }
            if ( y_sign < x_sign ) {
                return 1;
            }
            return ( x_sign * BigNum.cmp_abs( x, y ) );
        };
        
        BigNum.neg = function ( num ) {
            num = BigNum( num );
            var digit_info = num.get_digit_info(),
                tgt_digit_info = { sign : -1 * digit_info.sign, digit_list : digit_info.digit_list.slice( 0 ) };
            
            return BigNum( tgt_digit_info );
        };
        
        BigNum.add = function ( x, y ) {
            x = BigNum( x );
            y = BigNum( y );
            var x_info = x.get_digit_info(),
                y_info = y.get_digit_info();
            
            if ( ! x_info.sign ) {
                return BigNum( y_info );
            }
            if ( ! y_info.sign ) {
                return BigNum( x_info );
            }
            
            var z_info;
            
            if ( BigNum.cmp_abs( x, y ) < 0 ) {
                z_info = x_info;
                x_info = y_info;
                y_info = z_info;
            }
            return BigNum( add_digit_list( x_info, y_info ) );
        };
        
        BigNum.mul = function ( x, y ) {
            x = BigNum( x );
            y = BigNum( y );
            var x_info = x.get_digit_info(),
                y_info = y.get_digit_info();
            
            if ( ( ! x_info.sign ) || ( ! y_info.sign ) ) {
                return BigNum( get_zero_info() );
            }
            
            return BigNum( mul_digit_list( x_info, y_info ) );
        };
        
        BigNum.sub = function ( x, y ) {
            return BigNum.add( x, BigNum.neg( y ) );
        };
        
        BigNum.prototype.toString = function (){
            return this.get_digit_str();
        };
        
        BigNum.prototype.add = function ( n ) {
            return BigNum.add( this, n );
        };
        
        BigNum.prototype.sub = function ( n ) {
            return BigNum.sub( this, n );
        };
        
        BigNum.prototype.mul = function ( n ) {
            return BigNum.mul( this, n );
        };
        
        BigNum.prototype.cmp = function ( n ) {
            return BigNum.cmp( this, n );
        };
        
        BigNum.prototype.neg = function () {
            return BigNum.neg( this );
        }
        
        return BigNum;
    } )(); // end of BigNum()
    
    
    function get_date_str( time_sec ) {
        var dt = new Date( 1000 * time_sec );
        
        return dt.getUTCFullYear() + '-' + ( 1 + dt.getUTCMonth() ) + '-' + dt.getUTCDate();
    } // end of get_date_str()
    
    
    function get_id_from_utc_sec( utc_sec ) {
        var twepoc = ~~utc_sec  - TWEPOCH;
        
        return BigNum.mul( ID_INC_PER_SEC, twepoc );
    } // end of get_id_from_utc_sec()
    
    
    function get_id_range( tweet_id, time_sec ) {
        if ( ( ! ID_BEFORE ) || ( ! ID_AFTER ) || ( ( ! tweet_id ) && ( ! time_sec ) ) ) {
            return null;
        }
        if ( ! tweet_id ) {
            tweet_id = get_id_from_utc_sec( time_sec );
        }
        var current_id = BigNum( tweet_id ),
            since_id = current_id.sub( ID_BEFORE ),
            max_id = current_id.add( ID_AFTER );
        
        log_debug( 'since_id:' + since_id + ' current_id:' + current_id + ' max_id:' + max_id );
        
        if ( since_id.cmp( ID_THRESHOLD ) < 0 ) {
            return null;
        }
        
        return {
            current_id : current_id
        ,   since_id : since_id
        ,   max_id: max_id
        };
    } // end of get_id_range()
    
    
    function zero_padding( num, len ) {
        if ( ( ! len ) && ( len !== 0 ) ) {
            len = 2;
        }
        if ( len <= ( '' + num ).length ) {
            return '' + num;
        }
        return ( '0000000000' + num ).slice( -len );
    } // end of zero_padding()
    
    
    function get_gmt_from_tweet_id( tweet_id, offset_sec ) {
        var date = new Date( TWEPOCH_MSEC + ( ( offset_sec ) ? ( 1000 * offset_sec ) : 0 ) + ( tweet_id / ( 1 << 22 ) ) );
        
        return [
            [
                date.getUTCFullYear()
            ,   zero_padding( 1 + date.getUTCMonth() )
            ,   zero_padding( date.getUTCDate() )
            ].join( '-' )
        ,   '_'
        ,   [
                zero_padding( date.getUTCHours() )
            ,   zero_padding( date.getUTCMinutes() )
            ,   zero_padding( date.getUTCSeconds() )
            ].join( ':' )
        ,   '_GMT'
        ].join( '' );
    } // end of get_gmt_from_tweet_id()
    
    
    function get_search_url_list( tweet_id, screen_name, time_sec, max_id ) {
        var search_url_list = [],
            query = null,
            id_range;
        
        if ( tweet_id && tweet_id.current_id ) {
            id_range = tweet_id;
            tweet_id = id_range.current_id;
        }
        else {
            id_range = get_id_range( tweet_id, time_sec );
        }
        
        var source_hash = ( tweet_id ) ? ( '&_source_id=' + tweet_id ) : '';
        // ※ 最初は "#source_id=～" という形で指定していたが、タイミングによっては本スクリプトで取得する前にTwitter側で "#～" を消されてしまうため、変更
        
        if ( id_range ) {
            var since_id = id_range.since_id,
                max_id = id_range.max_id,
                since = get_gmt_from_tweet_id( since_id ),
                until = get_gmt_from_tweet_id( max_id, 1 );
            
            search_url_list.push( API_TIMELINE_BASE + screen_name + '/with_replies?max_position=' + max_id + source_hash ); // 0.2.3.10: max_id → max_position
            query = 'from:' + screen_name + ' since:' + since + ' until:' + until;
        }
        if ( ! query ) {
            if ( time_sec ) {
                var since = get_date_str( time_sec - ( 3600 * 24 * OPTIONS.DAY_BEFORE ) ),
                    until = get_date_str( time_sec + ( 3600 * 24 * ( 1 + OPTIONS.DAY_AFTER ) ) );
                
                query = 'from:' + screen_name + ' since:' + since + ' until:' + until;
            }
            else {
                search_url_list.push( API_TIMELINE_BASE + screen_name + '/with_replies?max_position=' + max_id + source_hash ); // 0.2.3.10: max_id → max_position
                if ( BigNum.cmp( max_id, ID_THRESHOLD ) < 0 ) {
                    query = 'from:' + screen_name + ' max_id:' + max_id;
                }
                else {
                    query = 'from:' + screen_name + ' until:' + get_gmt_from_tweet_id( max_id, 1 );
                }
            }
        }
        query += ' include:nativeretweets';
        search_url_list.push( API_SEARCH + '?q=' + encodeURIComponent( query ) + '&f=tweets' + source_hash );
        
        if ( OPTIONS.USE_SEARCH_TL_BY_DEFAULT && ( 2 <= search_url_list.length ) ) {
            var url_search_shift = search_url_list[ 0 ];
            
            search_url_list[ 0 ] = search_url_list[ 1 ];
            search_url_list[ 1 ] = url_search_shift;
        }
        
        return search_url_list;
    } // end of get_search_url_list()
    
    
    var is_child_url = ( function () {
        var re_id = /(?:#|&_)source_id=\d+/;
        
        return function ( url ) {
            if ( ! url ) {
                url = w.location.href;
            }
            return url.match( re_id );
        };
    } )(); // end of is_child_url()
    
    
    var get_source_id_from_url = ( function () {
        var re_id = /(?:#|&_)source_id=(\d+)/;
        
        return function ( url ) {
            if ( ! url ) {
                url = w.location.href;
            }
            return url.match( re_id ) ? RegExp.$1 : 0;
        };
    } )(); // end of get_source_id_from_url()
    
    
    var get_max_id_from_url = ( function () {
        var re_id = /(?:#|&|\?)max_(?:id|position)=(\d+)/;
        
        return function ( url ) {
            if ( ! url ) {
                url = w.location.href;
            }
            return url.match( re_id ) ? RegExp.$1 : 0;
        };
    } )(); // end of get_max_id_from_url()
    
    
    function wopen( url, cwin ) {
        if ( cwin ) {
            if ( cwin.location.href != url ) {
                cwin.location.href = url;
            }
        }
        else {
            cwin = w.open( url )
        }
        return cwin;
    } // end of wopen()
    
    
    function set_link_to_click( jq_link, onclick ) {
        var link_id = LINK_ID_PREFIX + ( LINK_ID_NUM ++ );
        
        jq_link.attr( 'id', link_id );
        LINK_DICT[ link_id ] = onclick;
        
        jq_link.click( function ( event ) {
            var link = $( this );
            
            onclick( link, event );
            return false;
        } );
        
        // jq_link.click( onclick ) だと、ツイートを「開く」→「閉じる」した後等にonclickがコールされなくなってしまう(Twitter側のスクリプトでイベントを無効化している？)
        // jq_link.attr( 'onclick', 'javascript:return ' + NAME_SCRIPT + '_click_link' + '( this, window.event || event )' );
        // → [2015.03.20] CSP設定変更により、onclick 属性への設定ができなくなった
        //jq_link.attr( 'target', '_blank' );   //  CSPによるonclick(インラインイベントハンドラ)使用禁止対策
        // → document の mouseover イベントを開始、onclick イベントが LINK_DICT に登録されている場合には、イベントを再設定するように修正
        
    } // end of set_link_to_click()
    
    
    function set_url_list_to_jq_link( jq_link, url_search_list ) {
        var len = url_search_list.length,
            ci = 0;
        
        if ( len < ci + 1 ) return;
        
        var url_search = url_search_list[ ci ++ ];
        
        jq_link.attr( 'href', url_search );
        if ( len < ci + 1 ) return;
        
        var url_search_shift = url_search_list[ ci ++ ];
        jq_link.attr( 'alt', url_search_shift );
    } // end of set_url_list_to_jq_link()
    
    
    var get_jq_link_container = ( function () {
        var jq_link_container_template = $( '<small><a></a></small>' ),
            style = $( '<style/>' );
        
        style.text(
            'a.' + NAME_SCRIPT + '_image {' + [
                'display : inline-block!important'
            ,   'width : 12px!important'
            ,   'height : 12px!important'
            ,   'margin : 0 3px 0 2px!important'
            ,   'padding : 0 0 0 0!important'
            ,   'text-decoration : none!important'
            ,   'background-image : url(' + LINK_ICON_URL + ' )'
            ,   'background-repeat : no-repeat'
            ,   'background-position : 0 0'
            ,   'background-size : 24px 12px'
            ].join( ';\n' ) + '}\n' + 
            'a.' + NAME_SCRIPT + '_image:hover {' + [
                'background-position-x : -12px'
            ].join( ';\n' ) + '}\n'
        );
        
        $( 'head' ).append( style );
        
        return function ( url_search_list, class_name, title, text, css ) {
            var jq_link_container = jq_link_container_template.clone( true ),
                jq_link = jq_link_container.find( 'a:first' );
            
            jq_link_container.addClass( class_name );
            jq_link.attr( 'title', title );
            
            set_url_list_to_jq_link( jq_link , url_search_list );
            jq_link.css( { 'font-size' : '12px' } );
            jq_link.css( css );
            
            if (
                OPTIONS.USE_LINK_ICON &&
                ( ! is_page_404 ) // TODO: 404 画面だと CSP エラー(Refused to load the image 'data:image/gif;base64,～' ...)になるため、除外
            ) {
                jq_link.addClass( NAME_SCRIPT + '_image' );
                jq_link.text( ' ' );
            }
            else {
                jq_link.text( text );
            }
            
            return { container : jq_link_container, link : jq_link };
        }; // end of get_jq_link_container()
    } )(); // end of get_jq_link_container()
    
    
    
    var get_tweet_li_clone_for_cwin = ( function () {
        var selector_list = [];
        
        $.each( CONTAINER_CLASS_LIST, function ( index, class_name ) {
            selector_list.push( 'small.' + class_name );
        } );
        
        var selector = selector_list.join( ',' );
        
        return function ( jq_tweet_li ) {
            if ( jq_tweet_li[ 0 ].tagName != 'LI' ) {
                jq_tweet_li = jq_tweet_li.parents( 'li:first' );
            }
            var jq_li_clone = jq_tweet_li.clone( true );
            
            jq_li_clone.find( selector ).each( function () {
                $( this ).remove();
                //log_debug( '* notice *: remove ' + this.className );
            } );
            
            return jq_li_clone;
        };
    } )(); // end of get_tweet_li_clone_for_cwin()
    
    
    function tweet_search( jq_link, event, tweet_id, time_sec, cwin, target_color, jq_tweet_li_target ) {
        var url_search = jq_link.attr( 'href' ),
            url_search_shift = jq_link.attr( 'alt' ),
            url_search_tweets = ( url_search && ( url_search.indexOf( API_SEARCH, 0 ) == 0 ) ) ? url_search : ( ( url_search_shift && ( url_search_shift.indexOf( API_SEARCH, 0 ) == 0 ) ) ? url_search_shift : null ),
            
            wait_cnt = MAX_CHECK_RETRY,
            last_tweet_id = null,
            jq_items = null,
            giveup_tid = null,
            remove = null,
            scrollTo = null,
            scrollTop = null,
            
            animate_tgt = ( $.browser.webkit ) ? 'body' : 'html',
            animate_speed = 'fast'; //  'slow', 'normal', 'fast' またはミリ秒単位の数値
        
        if ( event && event.shiftKey && url_search_shift ) {
            url_search = url_search_shift;
        }
        log_debug( 'tweet_search() ' + url_search );
        
        if ( url_search.indexOf( API_SEARCH, 0 ) != 0 ) {
            jq_tweet_li_target = null;
        }
        
        if ( ! target_color ) {
            target_color = OPTIONS.TARGET_TWEET_COLOR;
        }
        
        cwin = wopen( url_search, cwin );
        
        giveup_tid = setInterval( function () {
            if ( ! jq_items ) {
                return;
            }
            var jq_last_tweet = jq_items.find( '.js-stream-item[data-item-id]:last' ),
                tmp_tweet_id = ( 0 < jq_last_tweet.size() ) ? jq_last_tweet.attr( 'data-item-id' ) : null;
            
            if ( tmp_tweet_id == last_tweet_id ) {
                clearInterval( giveup_tid );
                giveup_tid = null;
                return;
            }
            last_tweet_id = tmp_tweet_id;
        }, 1000 * WAIT_BEFORE_GIVEUP_SCROLL_SEC );
        
        
        function check() {
            var $ = ( function () {
                try {
                    return cwin.jQuery;
                }
                catch ( error ) {
                    return null;
                }
            } )();
            
            if ( ! $ ) {
                setTimeout( check, INTV_CHECK_MS );
                log_debug( 'Waiting jQuery ready ...' );
                return;
            }
            
            if ( ! remove ) {
                //  突然タイムラインの特定のツイート(div.Grid要素)が削除され、それ以降のツイートが表示されなくなる不具合あり。(2014/06/08現在)
                //  本スクリプトを無効化しても再現するため、おそらくTwitter側の問題。
                //  → div.Grid要素のみ、削除されないよう暫定的にパッチ。
                remove = $.prototype.remove;
                $.prototype.remove = function (){
                    var className = this.attr ? this.attr( 'class' ) : null;
                    log_debug( '* notice *: remove element class=' + className );
                    if ( is_child_url( cwin.location.href )  && className && ( ' ' + className + ' ').match( / Grid / ) ) {
                        log_debug( ' => ignored' );
                        return this;
                    }
                    return remove.apply( this, arguments );
                }; // end of $.prototype.remove()
                
                // タイムライン閲覧中に意図しないタイミングでスクロールが発生する不具合あり。(2014/06/10現在)
                // → Twitter 側のスクリプトから移動させないように暫定対策。
                scrollTo = cwin.scrollTo;
                cwin.scrollTo = function () {
                    if ( is_child_url( cwin.location.href ) ) {
                        log_debug( '* notice *: scrollTo() ignored' );
                        return;
                    }
                    return scrollTo.apply( this, arguments );
                };  //  end of cwin.scrollTo()
                
                scrollTop = $.prototype.scrollTop;
                $.prototype.scrollTop = function (){
                    if ( is_child_url( cwin.location.href ) && ( 0 < arguments.length ) ) {
                        log_debug( '* notice *: scrollTop() ignored' );
                        return this;
                    }
                    return scrollTop.apply( this, arguments );
                };  //  end of $.prototype.scrollTop()
            }
            
            if ( ! jq_items ) {
                jq_items = $( [
                    'div.GridTimeline-items'
                ,   'ol.stream-items'
                ].join( ',' ) );
                
                if ( jq_items.size() <= 0 ) {
                    jq_items = null;
                    log_debug( 'item not found' );
                    return;
                }
            }
            if ( tweet_id ) {
                var jq_tweet = jq_items.find( [
                    'div.js-stream-tweet[data-retweet-id="' + tweet_id + '"]:first'
                ,   'div.js-stream-tweet[data-item-id="' + tweet_id + '"]:first'
                ].join( ',' ) );
            }
            else {
                var jq_tweet = null;
            }
            
            var flg_retweet_exists = false;
            
            if ( ( ! jq_tweet ) || ( jq_tweet.size() < 1 ) ) {
                jq_tweet = null;
                
                if ( $( '.empty-text' ).is( ':visible' ) ) {
                    // https://～/with_replies で「@～さんはまだツイートしていません。」が表示される場合、https://twitter.com/search の方へ移動
                    if ( url_search_tweets && ( url_search_tweets != url_search ) ) {
                        setTimeout( function () {
                            cwin.location.replace( url_search_tweets + '&_replaced=1' );
                        }, 100 );
                    }
                    log_debug( 'empty text was found' );
                    return;
                }
                
                jq_items.find( 'div.js-stream-tweet:not(".' + NAME_SCRIPT + '_touched")[data-item-id]' ).each( function () {
                    var jq_item = $( this );
                    
                    jq_item.addClass( NAME_SCRIPT + '_touched' );
                    
                    if ( ( ! jq_tweet ) && ( ! jq_item.attr( 'data-retweet-id' ) ) ) {
                        if ( time_sec && ( parseInt( jq_item.find( 'span[data-time]:first' ).attr( 'data-time' ) ) <= time_sec ) ) {
                            jq_tweet = jq_item;
                        }
                        else if ( tweet_id && ( BigNum( jq_item.attr( 'data-item-id' ) ).cmp( tweet_id ) < 0 ) ) {
                            jq_tweet = jq_item;
                        }
                    }
                } );
                
                if ( ! jq_tweet ) {
                    if ( ! giveup_tid ) {
                        log_debug( 'give up scrolling' );
                        return;
                    }
                    
                    var jq_last_tweet = jq_items.find( '.js-stream-item[data-item-id]:last' );
                    
                    if ( 0 < jq_last_tweet.size() ) {
                        log_debug( 'last tweet: data-item-id: ' + jq_last_tweet.attr( 'data-item-id' ) + ' top: ' + jq_last_tweet.offset().top );
                        $( animate_tgt ).animate( { scrollTop : jq_last_tweet.offset().top }, animate_speed );
                    }
                    if ( $( 'div.stream-end' ).is( ':visible' ) ) {
                        wait_cnt --;
                        if ( wait_cnt <= 0 ) {
                            if ( jq_tweet_li_target ) {
                                var jq_tweet_li_target_clone = get_tweet_li_clone_for_cwin( jq_tweet_li_target );
                                try {
                                    jq_items.find( '.js-stream-item[data-item-id]:last' ).after( jq_tweet_li_target_clone );
                                    jq_tweet_li_target_clone.css( 'background-color', target_color );
                                }
                                catch ( error ){
                                }
                            }
                            log_debug( 'stream-end found: retry over' );
                            return;
                        }
                        log_debug( 'stream-end found: remaining count = ' + wait_cnt );
                    }
                    else {
                        wait_cnt = MAX_CHECK_RETRY;
                    }
                    setTimeout( check, INTV_CHECK_MS );
                    return;
                }
                
                target_color = OPTIONS.VICINITY_TWEET_COLOR;
                log_debug( 'Pattern B:' + tweet_id + ' ' + jq_tweet.attr( 'data-item-id' ) );
            }
            else {
                if ( jq_tweet.attr( 'data-retweet-id' ) == tweet_id ) {
                    flg_retweet_exists = true;
                    target_color = OPTIONS.VICINITY_TWEET_COLOR;
                }
                log_debug( 'Pattern A:' + tweet_id + ' ' + jq_tweet.attr( 'data-item-id' ) );
            }
            
            var jq_tweet_li = ( jq_tweet.hasClass( 'js-stream-item' ) ) ? jq_tweet : jq_tweet.parents( '.js-stream-item' );
            
            if ( 0 < jq_tweet_li.size() ) {
                if ( ( jq_tweet_li_target ) && ( ! flg_retweet_exists ) ) {
                    var jq_tweet_li_target_clone = get_tweet_li_clone_for_cwin( jq_tweet_li_target );
                    try {
                        jq_tweet_li.before( jq_tweet_li_target_clone );
                        jq_tweet_li = jq_tweet_li_target_clone;
                    }
                    catch ( error ) {
                    }
                }
            }
            else {
                jq_tweet_li = jq_tweet;
            }
            
            var jq_tweet_li_innter = jq_tweet_li.find( 'div.js-tweet' );
            
            if ( 0 < jq_tweet_li_innter.size() ) {
                jq_tweet_li_innter.css( 'background-color', target_color );
            }
            else {
                jq_tweet_li.css( 'background-color', target_color );
            }
            
            function adjust() {
                $( animate_tgt ).animate( { scrollTop : jq_tweet_li.offset().top - $( cwin ).height() / 2 }, animate_speed );
            } // end of adjust()
            
            adjust();
            setTimeout( function (){
                adjust();
                // ※タイムラインが表示しきれておらず目的ツイートを真ん中にもってこれなかった場合等のために時間をずらして再度スクロール
            }, INTV_CHECK_MS);
            
            log_debug( 'target tweet was found' );
            
            return;
        } // end of check()
        
        check();
    } // end of tweet_search()
    
    
    function add_container_to_tweet( jq_tweet, jq_link_container ) {
        var jq_insert_point = jq_tweet.find( 'a.ProfileTweet-timestamp' ).parent();
        
        if ( jq_insert_point.size() <= 0 ) {
            jq_insert_point = jq_tweet.find( 'small.time:first' );
        }
        jq_insert_point.after( jq_link_container );
        jq_tweet.find( 'div.client-and-actions span.metadata:first' ).after( jq_link_container.clone( true ) );
    } // end of add_container_to_tweet()
    
    
    function add_rtlink_to_tweet( jq_tweet ) {
        var retweet_id = jq_tweet.attr( 'data-retweet-id' ),
            retweeter = jq_tweet.attr( 'data-retweeter' );
        
        if ( ( ! retweet_id ) || ( ! retweeter ) ) return;
        
        var id_range = get_id_range( retweet_id ),
            url_rt_search_list = get_search_url_list( id_range, retweeter, null, retweet_id ),
            result = get_jq_link_container( url_rt_search_list, ACT_CONTAINER_CLASS, OPTIONS.ACT_LINK_TITLE, OPTIONS.ACT_LINK_TEXT, { 'color' : OPTIONS.ACT_LINK_COLOR, 'padding' : '4px' } ),
            jq_rtlink_container = result.container,
            jq_rtlink = result.link,
            jq_append_point = jq_tweet.find( 'div.ProfileTweet-context:first' ),
            flg_enable_insert = ( 0 < jq_append_point.size() ) ? false : true;
        
        if ( id_range ) {
            set_link_to_click( jq_rtlink, function ( link, event ) {
                tweet_search( jq_rtlink, event, retweet_id, null, null, OPTIONS.VICINITY_TWEET_COLOR, ( ( flg_enable_insert ) ? jq_tweet : null ) );
                return false;
            } );
        }
        else {
            set_link_to_click( jq_rtlink, function ( link, event ) {
                var cwin = wopen( 'about:blank' );
                
                function callback( html ) {
                    var click = null;
                    
                    if ( html.match( /<li\s*class="[\s\S]*?stream-item[\s\S]*?data-item-id="(\d+)"/i ) ) {
                        var tweet_id = RegExp.$1;
                        
                        if ( html.match( /<span\s*class="[\s\S]*?_timestamp[\s\S]*?\s*data-time="(\d+)"/i ) ) {
                            var time_sec = parseInt( RegExp.$1 ),
                                url_search_list = get_search_url_list( tweet_id, retweeter, time_sec );
                            
                            set_url_list_to_jq_link( jq_rtlink, url_search_list );
                            
                            click = function ( jq_rtlink2, cwin, link, event ) {
                                tweet_search( jq_rtlink2, event, tweet_id, time_sec, cwin, OPTIONS.VICINITY_TWEET_COLOR, ( ( flg_enable_insert ) ? jq_tweet : null ) );
                                return false;
                            };  //  end of click()
                        }
                    }
                    if ( ! click ) {
                        click = function ( jq_rtlink2, cwin, link, event ) {
                            tweet_search( jq_rtlink2, event, retweet_id, null, null, OPTIONS.VICINITY_TWEET_COLOR, ( ( flg_enable_insert ) ? jq_tweet: null ) );
                            return false;
                        };  //  end of click()
                    }
                    
                    var jq_rtlink2 = jq_rtlink.clone();
                    
                    set_link_to_click( jq_rtlink2, function ( link, event ) {
                        click( jq_rtlink2, cwin, link, event );
                    });
                    
                    jq_rtlink.after( jq_rtlink2 );
                    jq_rtlink.remove();
                    
                    click( jq_rtlink2, cwin, link, event );
                    cwin = null;
                };  //  end of callback()
                
                $.get( url_rt_search, callback, 'html' ); // $.ajax( { url : url_rt_search, success : callback, dataType : 'html' } );
                
                return false;
            });
        }
        if ( jq_append_point.size() <= 0 ) {
            jq_append_point = jq_tweet.find( 'div.context:first' ).find( 'div.with-icn:first' );
        }
        jq_append_point.append( jq_rtlink_container );
    } // end of add_rtlink_to_tweet()
    
    
    function add_link_to_tweet( jq_tweet ) {
        //if ( ! jq_tweet.is( ':visible' ) ) { return; } //  このチェックを入れるとかえって遅くなってしまう
        
        var jq_container = jq_tweet.find( 'small.' + LINK_CONTAINER_CLASS );
        
        if ( 0 < jq_container.size() ) {
            return;
        }
        var tweet_id = jq_tweet.attr( 'data-item-id' ),
            screen_name = jq_tweet.attr( 'data-screen-name' );
        
        if ( ( ! tweet_id ) || ( ! screen_name ) ) {
            return;
        }
        log_debug( 'add_link_to_tweet() screen_name:' + screen_name + ' tweet_id:' + tweet_id );
        
        var time_sec = parseInt( jq_tweet.find( 'span[data-time]:first' ).attr( 'data-time' ) ),
            url_search_list = get_search_url_list( tweet_id, screen_name, time_sec ),
            result = get_jq_link_container( url_search_list, LINK_CONTAINER_CLASS, OPTIONS.LINK_TITLE, OPTIONS.LINK_TEXT, { 'color' : OPTIONS.LINK_COLOR, 'padding' : '4px' } ),
            jq_link_container = result.container,
            jq_link = result.link;
        
        set_link_to_click( jq_link, function ( link, event ) {
            tweet_search( jq_link, event, tweet_id, time_sec );
            return false;
        } );
        
        add_container_to_tweet( jq_tweet, jq_link_container );
        
        add_rtlink_to_tweet( jq_tweet );
        
    } // end of add_link_to_tweet()
    
    
    function add_link_to_activity( jq_activity ) {
        if ( 0 < jq_activity.find( 'small.' + ACT_CONTAINER_CLASS ).size() ) {
            return;
        }
        var jq_timestamp = jq_activity.find( 'div.activity-timestamp span[data-time]:first' );
        if ( jq_timestamp.size() < 1 ) {
            return;
        }
        var jq_tweet = jq_activity.find( 'div.tweet:first' ),
            tweet_id = ( 0 < jq_tweet.size() ) ? jq_tweet.attr( 'data-item-id' ) : null,
            time_sec = parseInt( jq_timestamp.attr( 'data-time' ) ),
            min_sec = parseInt( jq_activity.attr( 'data-activity-min-position' ) ) / 1000,
            max_sec = parseInt( jq_activity.attr( 'data-activity-max-position' ) ) / 1000;
        
        log_debug( 'add_link_to_activity() time:' + time_sec + ' min:' + min_sec + ' max:' + max_sec );
        
        jq_activity.find( 'ol.activity-supplement a.js-user-tipsy[data-user-id],a.js-action-profile-name' ).each( function () {
            var jq_user_link = $( this ),
                screen_name = jq_user_link.attr( 'href' ).replace( /^.*\//, '' ),
                url_search_list = get_search_url_list( null, screen_name, time_sec ),
                result = get_jq_link_container( url_search_list, ACT_CONTAINER_CLASS, OPTIONS.ACT_LINK_TITLE, OPTIONS.ACT_LINK_TEXT, { 'color' : OPTIONS.ACT_LINK_COLOR } ),
                jq_link_container = result.container,
                jq_link = result.link;
            
            set_link_to_click( jq_link, function ( link, event ) {
                tweet_search( jq_link, event, tweet_id, min_sec, null, OPTIONS.VICINITY_TWEET_COLOR, jq_activity );
                return false;
            } );
            if ( jq_user_link.hasClass( 'js-user-tipsy' ) && jq_link.hasClass( NAME_SCRIPT + '_image' ) ) {
                jq_user_link.find( 'img.avatar' ).css( {
                    'margin-right' : '0'
                } );
            }
            jq_user_link.after( jq_link_container );
        } );
        
    } // end of add_link_to_activity()
    //}
    
    
    //{ ■ エントリポイント
    function main_proc() {
        log_debug( 'Initializing...' );
        log_debug( 'document.referrer: ' + d.referrer );
        
        var current_url = w.location.href,
            src_tweet_id = get_source_id_from_url( current_url ),
            max_tweet_id = BigNum( src_tweet_id ),
            max_id_from_url = get_max_id_from_url( current_url ),
            container_selector_list = [
                'div.GridTimeline-items'
            ,   'ol.stream-items'
            ,   'ol.recent-tweets'
            ,   'div.permalink-tweet-container'
            ,   'div.GalleryTweet'
            ],
            container_selector = container_selector_list.join( ',' ),
            tweet_selector_list = [];
        
        ID_BEFORE = BigNum.mul( ID_INC_PER_SEC, SEC_BEFORE );
        ID_AFTER = BigNum.mul( ID_INC_PER_SEC, SEC_AFTER );
        ID_THRESHOLD = BigNum( ID_THRESHOLD );
        
        log_debug( 'ID_INC_PER_SEC=' + ID_INC_PER_SEC );
        log_debug( 'ID_BEFORE=' + ID_BEFORE );
        log_debug( 'ID_AFTER=' + ID_AFTER );
        log_debug( 'ID_THRESHOLD=' + ID_THRESHOLD );
        
        $.each( container_selector_list, function ( index, selector_item ) {
            tweet_selector_list.push( selector_item + ' div.tweet' );
            tweet_selector_list.push( selector_item + ' div.js-stream-tweet' );
        } );
        
        var tweet_selector = tweet_selector_list.join( ',' ),
            activity_selector = 'div.stream-item-activity-notification[data-activity-type]';
        
        $( tweet_selector ).each( function () {
            var jq_tweet = $( this ),
                tweet_id = jq_tweet.attr( 'data-retweet-id' ) || jq_tweet.attr( 'data-item-id' );
            
            add_link_to_tweet( jq_tweet );
            if ( max_tweet_id.cmp( tweet_id ) < 0 ) {
                max_tweet_id = BigNum( tweet_id );
            }
        } );
        
        $( activity_selector ).each( function () {
            var jq_activity = $( this );
            
            add_link_to_activity( jq_activity );
        } );
        
        log_debug( 'src_tweet_id:' + src_tweet_id );
        log_debug( 'max_tweet_id:' + max_tweet_id );
        log_debug( 'max_id_from_url:' + max_id_from_url );
        
        
        function check_inserted_node( target_node ) {
            var flg_hit = false,
                jq_target = $( target_node );
            
            ( ( jq_target.hasClass( 'js-stream-tweet' ) || jq_target.hasClass( 'tweet' ) ) ? jq_target : jq_target.find( 'div.js-stream-tweet,div.tweet' ) ).each( function () {
                var jq_tweet = $( this );
                
                if ( jq_tweet.parents( container_selector ).size() <= 0 ) {
                    return;
                }
                add_link_to_tweet( jq_tweet );
                
                flg_hit = true;
                
                if ( ( ! OPTIONS.HIDE_NEWER_TWEETS ) || ( ( ! src_tweet_id ) && ( ! max_id_from_url ) ) ) {
                    return;
                }
                
                var jq_container = null;
                jq_tweet.parents( 'div.StreamItem:first,div.Grid:first,li:first' ).each( function () {
                    var jq_container_tmp = $( this );
                    
                    if ( 0 < jq_container_tmp.parent( container_selector ).size() ) {
                        jq_container = jq_container_tmp;
                        return false;
                    }
                } );
                if ( ! jq_container ) {
                    return;
                }
                var tweet_id = jq_tweet.attr( 'data-retweet-id' ) || jq_tweet.attr( 'data-item-id' );
                if ( max_tweet_id.cmp( tweet_id ) < 0 ) {
                    jq_tweet.hide();
                    jq_container.hide();
                    log_debug( '* notice *: hide ' + jq_tweet.attr( 'data-item-id' ) );
                }
            } );
            
            ( jq_target.hasClass( 'stream-item-activity-notification' ) ? jq_target : jq_target.find( activity_selector ) ).each( function () {
                var jq_activity = $( this );
                
                add_link_to_activity( jq_activity );
                flg_hit = true;
            } );
            
            if ( ( ! OPTIONS.HIDE_NEWER_TWEETS ) || ( ( ! src_tweet_id ) && ( ! max_id_from_url ) ) ) {
                return flg_hit;
            }
            
            ( jq_target.hasClass( 'js-new-tweets-bar' ) ? jq_target : jq_target.find( 'div.js-new-tweets-bar') ).each( function () {
                var jq_new_bar = $( this ),
                    jq_container = jq_new_bar.parent( 'div.stream-item' );
                
                if ( jq_container.size() <= 0 ) {
                    return;
                }
                jq_new_bar.hide();
                jq_container.hide();
                log_debug( '* notice *: hide new tweets bar' );
            } );
            
            return flg_hit;
        } // end of check_inserted_node()
        
        
        function check_form404() {
            var jq_form404 = $( 'form.search-404' );
            
            if ( jq_form404.size() < 1 ) {
                return false;
            }
            if ( ! current_url.match( /\/([^/]+)\/status(?:es)?\/(\d+)/ ) ) {
                return false;
            }
            
            var screen_name = RegExp.$1,
                tweet_id = RegExp.$2,
                url_search_list = get_search_url_list( tweet_id, screen_name ),
                result = get_jq_link_container( url_search_list, LINK_CONTAINER_CLASS, OPTIONS.LINK_TITLE, OPTIONS.LINK_TEXT, { 'color' : OPTIONS.LINK_COLOR, 'padding' : '4px' } ),
                jq_link_container = result.container,
                jq_link = result.link;
            
            set_link_to_click( jq_link, function ( link, event ) {
                //tweet_search( jq_link, event, tweet_id );
                //  ※ 404 の window からは子windowにアクセスできない
                //      (Google Chrome)
                //      Uncaught SecurityError: Blocked a frame with origin "https://twitter.com" from accessing a frame with origin "https://twitter.com".
                //      The frame being accessed set "document.domain" to "twitter.com", but the frame requesting access did not. Both must set "document.domain" to the same value to allow access.
                
                var url_search = jq_link.attr( 'href' ),
                    url_search_shift = jq_link.attr( 'alt' );
                
                if ( event && event.shiftKey && url_search_shift ) {
                    url_search = url_search_shift;
                }
                var cwin = wopen( url_search );
                
                return false;
            } );
            
            var jq_h1 = $( 'h1:first' ),
                h1_html = jq_h1.html(),
                html_lang = $( 'html' ).attr( 'lang' );
            
            function check() {
                var jq_h1 = $( 'h1:first' );
                
                if ( jq_h1.html() == h1_html ) {
                    setTimeout( check, INTV_CHECK_MS );
                    return;
                }
                jq_h1.append( jq_link );
            } // end of check()
            
            if ( ( html_lang == LANGUAGE ) || ( ! h1_html.match( /sorry/i ) ) ) {
                jq_h1.append( jq_link );
            }
            else {
                check();
            }
            
            return true;
        } // end of check_form404()
        
        
        function check_uncontrolled_window() {
            if ( ! src_tweet_id ) {
                return;
            }
            
            var valid_parent = ( function () {
                try {
                    return w.opener.jQuery
                }
                catch ( error ) {
                    return null
                }
            } )();
            
            if (
                ( valid_parent ) &&
                ( w.opener.$( 'form.search-404' ).size() <= 0 ) &&
                ( w.history.length < 2 ) &&
                ( ! current_url.match( /(?:#|&_)replaced=1(?:#|&_|$)/ ) ) 
            ) {
                return;
            }
            
            //  親windowにアクセスできない(親windowからコントロールできない)場合
            var jq_link = $( '<a/>' );
            jq_link.attr( 'href', current_url );
            
            setTimeout( function () {
                tweet_search( jq_link, null, src_tweet_id, null, w );
            }, INTV_CHECK_MS );
            
        } // end of check_uncontrolled_window()
        
        
        new MutationObserver( function ( records ) {
            log_debug( '*** MutationObserver ***' );
            
            if ( current_url != w.location.href ) {
                current_url = w.location.href;
                src_tweet_id = get_source_id_from_url( current_url );
                max_tweet_id = BigNum( src_tweet_id );
                max_id_from_url = get_max_id_from_url( current_url );
                
                log_debug( '*** URL changed' );
                log_debug( 'src_tweet_id:' + src_tweet_id );
                log_debug( 'max_tweet_id:' + max_tweet_id );
                log_debug( 'max_id_from_url:' + max_id_from_url );
            }
            
            $.each( records, function ( index, record ) {
                $.each( record.addedNodes, function ( index, addedNode ) {
                    if ( addedNode.nodeType != 1 ) {
                        return;
                    }
                    check_inserted_node( addedNode );
                } );
            } );
            
        } ).observe( d.body, { childList : true, subtree : true } );
        
        
        $( d ).mouseover( function ( event ){
            // set_link_to_click() でセットした click イベントが、ツイートを「開く」→「閉じる」を実施すると無効化される(Twitter側のスクリプトの動作と思われる)
            // → mouseover イベント発火時に、click イベントを再設定することで対応
            
            var jq_target = $( event.target ),
                onclick = LINK_DICT[ jq_target.attr( 'id' ) ];
            
            if ( onclick ) {
                jq_target.unbind( 'click' );
                jq_target.click( function ( event ) {
                    var link = $( this );
                    
                    onclick( link, event );
                    return false;
                } );
            }
            return false;
        } );
        
        check_form404();
        
        check_uncontrolled_window();
        
        log_debug( 'All set.' );
    
    };  // end of main_proc()
    
    main_proc();
    
    //} end of main procedure
    
} // end of main()


function initialize( user_options ) {
    w.twDisplayVicinity_Options = user_options;
    
    if ( typeof w.jQuery == 'function' ) {
        main( w, d );
        return;
    }
    
    var user_agent = window.navigator.userAgent.toLowerCase();
    
    if ( d.querySelector( 'form.search-404' ) ) {
        // ※ 404画面では CSP によりインラインスクリプトはブロックされてしまうので、main() を直接呼び出す
        // TODO: Tampermonkey だとうまく動作しない
        if ( user_agent.indexOf( 'chrome' ) < 0 ) {
            main( w, d );
            return;
        }
    }
    
    var add_content_script = ( function() {
        var container = d.documentElement,
            nonce_script = d.querySelector( 'script[nonce]' ),
            nonce = ( nonce_script ) ? nonce_script.getAttribute( 'nonce' ) : null;
        
        return function ( textcontent ) {
            var script = d.createElement( 'script' );
            
            if ( nonce ) {
                script.setAttribute( 'nonce', nonce );
            }
            script.textContent = textcontent;
            container.appendChild( script );
        };
    } )(); // end of add_content_script()
    
    try {
        if ( user_options ) {
            add_content_script( 'window.twDisplayVicinity_Options = ' + JSON.stringify( user_options ) + ';' );
        }
        add_content_script( '(' + main.toString() + ')( window, document );' );
    }
    catch( error ) {
        main( w, d );
    }
    
} // end of initialize()


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
