// ==UserScript==
// @name           twDisplayVicinity
// @namespace      http://d.hatena.ne.jp/furyu-tei
// @include        http://twitter.com/*
// @include        https://twitter.com/*
// @description    display the vicinity of a particular tweet on Twitter ver.0.02b1
// ==/UserScript==
/*
  Download: https://github.com/furyutei/twDisplayVicinity/raw/master/twDisplayVicinity.user.js
  GitHub: https://github.com/furyutei/twDisplayVicinity
  Related article: http://d.hatena.ne.jp/furyu-tei/20140327/1395914958
  Original(bookmarklet): http://let.hatelabo.jp/furyu-tei/let/hLHVnMG9q-NH
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

(function(w, d){
var main = function(w, d){
	//{ user parameters
	var DEBUG = false;
	var	DEBUG_USE_CONSOLE_LOG = true;
	
	var	HIDE_NEWER_TWEETS = true;
	
	var	DAY_BEFORE = 1;
	var	DAY_AFTER = 1;
	
	//var	HIGH_TIME_RESOLUTION = false;
	var	HIGH_TIME_RESOLUTION = true;
	var	HOUR_BEFORE = 24;	//	enabled if HIGH_TIME_RESOLUTION is true
	var	HOUR_AFTER = 8;		//	enabled if HIGH_TIME_RESOLUTION is true
	
	var	TARGET_TWEET_COLOR = 'gold';
	var	VICINITY_TWEET_COLOR = 'pink';
	
	var	LINK_COLOR = 'darkblue';
	var	LINK_TEXT = '\u8fd1\u508d';	//	"近傍"
	var	LINK_TITLE = '\u8fd1\u508d\u30c4\u30a4\u30fc\u30c8\u8868\u793a';	//	"近傍ツイート表示"
	var	EN_LINK_TEXT = 'vicinity';
	var	EN_LINK_TITLE = 'search vicinity tweets';
	
	var	ACT_LINK_COLOR = 'indigo';
	var	ACT_LINK_TEXT = '\u8fd1\u508d';	//	"近傍"
	var	ACT_LINK_TITLE = '\u30a2\u30af\u30b7\u30e7\u30f3\u306e\u8fd1\u508d\u30c4\u30a4\u30fc\u30c8\u8868\u793a';	//	"アクションの近傍ツイート表示"
	var	EN_ACT_LINK_TEXT = 'vicinity';
	var	EN_ACT_LINK_TITLE = 'search vicinity tweets around action';
	
	var	FLG_TWITSPRITZ = true;
	var	TS_LINK_COLOR = 'darkgreen';
	var	TS_LINK_TEXT = 'TwitSpritz';
	var	TS_LINK_TITLE = 'TwitSpritz\x3a\x20Spritz\u3082\u3069\u304d\u8868\u793a';	//	"TwitSpritz: Spritzもどき表示"
	var	EN_TS_LINK_TEXT = 'TwitSpritz';
	var	EN_TS_LINK_TITLE = 'TwitSpritz: show tweet like "TwitSpritz"';
	
	//} end of user parameters
	
	
	//{ global variables
	var NAME_SCRIPT = 'twDisplayVicinity';
	var VER_SCRIPT = '0.02b1';
	var $=w.$;
	
	//{ check environment
	if (w[NAME_SCRIPT+'_touched']) return;
	if (!$) {
		if (!d.getElementById(NAME_SCRIPT+'_jq')) {
			var	forms = d.getElementsByTagName('form');
			for (var ci=0,len=forms.length; ci<len; ci++) {
				if ((' '+forms[ci].className+' ').match(/ search-404 /)) {
					var	script = d.createElement('script');
					script.id = NAME_SCRIPT+'_jq';
					script.src='//ajax.googleapis.com/ajax/libs/jquery/1.8.3/jquery.min.js';
					d.body.appendChild(script);
					break;
				}
			}
		}
		var main = arguments.callee; setTimeout(function(){main(w,d);}, 100); return;
	}
	w[NAME_SCRIPT+'_touched'] = true;
	//} end of check environment
	
	var	LANG = (function(){try{return (w.navigator.browserLanguage || w.navigator.language || w.navigator.userLanguage).substr(0,2)}catch(e){return 'en'}})();
	if (LANG != 'ja') {
		LINK_TEXT = EN_LINK_TEXT;
		LINK_TITLE = EN_LINK_TITLE;
		ACT_LINK_TEXT = EN_ACT_LINK_TEXT;
		ACT_LINK_TITLE = EN_ACT_LINK_TITLE;
		TS_LINK_TEXT = EN_TS_LINK_TEXT;
		TS_LINK_TITLE = EN_TS_LINK_TITLE;
	}
	var	API_SEARCH = 'https://twitter.com/search';
	var	API_TIMELINE_BASE = 'https://twitter.com/';
	
	var	FNAME_ON_CLICK = NAME_SCRIPT+'_click_link';
	var	LINK_ID_PREFIX = NAME_SCRIPT+'_link_';
	
	var	LINK_CONTAINER_CLASS = NAME_SCRIPT+'_link_container';
	var	ACT_CONTAINER_CLASS = NAME_SCRIPT+'_act_container';
	var	TS_CONTAINER_CLASS = NAME_SCRIPT+'_ts_container';
	
	var	CONTAINER_CLASS_LIST = [LINK_CONTAINER_CLASS, ACT_CONTAINER_CLASS, TS_CONTAINER_CLASS];
	
	var	LINK_DICT = {};
	var	LINK_ID_NUM = 1;
	
	var	INTV_CHECK_MS = 300;	// ms
	var	MAX_CHECK_RETRY = 3;
	var	WAIT_BEFORE_GIVEUP_SCROLL_SEC = 10;
	
	var	ID_INC_PER_SEC = 1000*(0x01 << 22);
	var	SEC_BEFORE = HOUR_BEFORE * 3600;
	var	SEC_AFTER = HOUR_AFTER * 3600;
	var	TWEPOCH = ~~(1288834974657/1000);	//	1288834974.657 sec (2011.11.04 01:42:54(UTC)) (via http://www.slideshare.net/pfi/id-15755280)
	var	ID_THRESHOLD = '300000000000000';	//	2010.11.04 22時(UTC)頃に、IDが 30000000000以下から300000000000000以上に切り替え
	var	ID_BEFORE = null;
	var	ID_AFTER = null;
	
	//} end of global variables
	
	
	//{ functions
	var	log = w.log = (function(){
		var	con = w.console;
		if (!con || !con.log) return function(){};
		var	con_log = con.log;
		return function(str){
			con_log.call(con, str);
		};
	})();	//	end of log()
	
	var log_debug = (function(){
		if (!DEBUG) return function(){};
		if (DEBUG_USE_CONSOLE_LOG) {
			return function(str){
				//console.log(NAME_SCRIPT+' ['+new Date().toISOString()+'] '+str);	//	Twitter側で console.log が無効化されているため途中から表示されなくなってしまう
				log(NAME_SCRIPT+' ['+new Date().toISOString()+'] '+str);
			};
		}
		else {
			var jq_log_container = $('<textarea id="'+NAME_SCRIPT+'_log" style="width:100%; height:100px; background:lightblue; text-align:left; overflow-y:scroll" readonly></textarea>')
			$('div.global-nav').append(jq_log_container);
			$('div.global-nav').css('height', '140px');
			return function(str){
				jq_log_container.html(jq_log_container.html()+NAME_SCRIPT+' ['+new Date().toISOString()+'] '+str+'\n');
				jq_log_container.scrollTop(jq_log_container.prop('scrollHeight'));
			};
		}
	})();	//	end of log_debug()
	
	var	BigNum = (function(){
		var	DIGIT_UNIT_LEN = 7;
		var	DIV_UNIT = Math.pow(10, DIGIT_UNIT_LEN);
		
		var	re_digit = /^\s*([+\-]?)0*(\d+)\s*$/;
		var	re_zerosup = /^0*(\d+)$/;
		var	get_zero_info = function(){return {sign: 0, digit_list: [0]}};
		var	zero_str = new Array(DIGIT_UNIT_LEN).join('0');
		var	zero_pad = function(num, len){
			if (!len) len = DIGIT_UNIT_LEN;
			if (num.length == len) return num;
			if (len == DIGIT_UNIT_LEN) return (zero_str+num).slice(-len);
			return (new Array(len).join('0')+num).slice(-len);
		};
		var	get_digit_info = function(num){
			if (!(''+num).match(re_digit)) return get_zero_info();
			if (RegExp.$2 == '0') return get_zero_info();
			var	sign = (RegExp.$1=='-') ? -1 : 1, digit_str = RegExp.$2, digit_list = [];
			for (var pos = digit_str.length; 0<pos; pos-=DIGIT_UNIT_LEN) {
				digit_list.push(parseInt(digit_str.slice((pos<DIGIT_UNIT_LEN) ? 0 : pos-DIGIT_UNIT_LEN, pos)));
			}
			return {sign: sign, digit_list: digit_list};
		};
		var	get_digit_str = function(sign, digit_list){
			if (!sign) return '0';
			var	digit_str_list = [];
			var	pos = digit_list.length-1;
			digit_str_list.push(digit_list[pos--]);
			for (; 0<=pos; pos--) digit_str_list.push(zero_pad(digit_list[pos]));
			return ((sign<0) ? '-' : '')+digit_str_list.join('');
		};
		var	add_digit_list = function(x_info, y_info){
			var	x_sign = x_info.sign, x_digit_list = x_info.digit_list, xlen = x_digit_list.length;
			var	y_sign = y_info.sign, y_digit_list = y_info.digit_list, ylen = y_digit_list.length;
			var	z_sign = 0, z_digit_list = [];
			var	cx, cy, cz=0, cs=0;
			for (var pos=0, len=Math.max(xlen, ylen); pos<len; pos++) {
				cx = (pos<xlen) ? x_digit_list[pos] : 0;
				cy = (pos<ylen) ? y_digit_list[pos] : 0;
				cx = x_sign*cx; cy = y_sign*cy;
				cz += cx+cy;
				cs = (x_sign*cz<0) ? x_sign*DIV_UNIT : 0;
				cz += cs;
				if (cz) z_sign = cz<0 ? -1 : 1;
				//log_debug('x_sign='+x_sign+' y_sign='+y_sign+' cx='+cx+' cy='+cy+' cz='+cz+' cs='+cs);
				z_digit_list.push(z_sign*(cz%DIV_UNIT));
				cz = ~~(cz/DIV_UNIT)-~~(cs/DIV_UNIT);
			}
			if (1<=Math.abs(cz)) z_digit_list.push(cz);
			return {sign: z_sign, digit_list: z_digit_list};
		};
		var	mul_digit_list = function(x_info, y_info){
			var	x_sign = x_info.sign, x_digit_list = x_info.digit_list, xlen = x_digit_list.length;
			var	y_sign = y_info.sign, y_digit_list = y_info.digit_list, ylen = y_digit_list.length;
			var	z_sign = x_sign*y_sign, zlen = xlen+ylen+1, z_digit_list = new Array(zlen);
			for (var zpos=0; zpos<zlen; zpos++) z_digit_list[zpos] = 0;
			var	cx, cy, cz;
			for (var xpos=0; xpos<xlen; xpos++) {
				cx = x_digit_list[xpos];
				cz = 0;
				for (var ypos=0; ypos<ylen; ypos++) {
					cy = y_digit_list[ypos];
					cz += z_digit_list[xpos+ypos] + cx * cy;
					z_digit_list[xpos+ypos] = cz%DIV_UNIT;
					cz = ~~(cz/DIV_UNIT);
				}
				z_digit_list[xpos+ypos] = cz;
			}
			for (var zpos=zlen-1; 0<zpos; zpos--) {
				if (z_digit_list[zpos]) break;
				z_digit_list.pop();
			}
			return {sign: z_sign, digit_list: z_digit_list};
		};
		var	BigNum = function(num){
			if (num instanceof BigNum) return num;
			var	self = this;
			if (!(self instanceof BigNum)) return new BigNum(num);
			var	digit_info = null, digit_str = null;
			self.get_num = function(){return num};
			self.set_num = function(_num){
				num = _num;
				digit_info = get_digit_info(_num);
				digit_str = get_digit_str(digit_info.sign, digit_info.digit_list);
			};
			self.get_digit_info = function(){return digit_info};
			self.set_digit_info = function(_digit_info){
				digit_info = _digit_info;
				//digit_info = {sign: _digit_info.sign, digit_list: _digit_info.digit_list};
				num = digit_str = get_digit_str(digit_info.sign, digit_info.digit_list);
			};
			self.get_digit_str = function(){
				return digit_str;
			};
			if (num.hasOwnProperty('sign') && num.hasOwnProperty('digit_list')) {
				self.set_digit_info(num);
			}
			else {
				self.set_num(num);
			}
		};
		BigNum.cmp_abs = function(x, y){
			x = BigNum(x); y = BigNum(y);
			var	x_digit_list = x.get_digit_info().digit_list;
			var	y_digit_list = y.get_digit_info().digit_list;
			if (x_digit_list.length < y_digit_list.length) return -1;
			if (x_digit_list.length > y_digit_list.length) return 1;
			for (var pos = x_digit_list.length-1; 0<=pos; pos--) {
				if (x_digit_list[pos] < y_digit_list[pos]) return -1;
				if (x_digit_list[pos] > y_digit_list[pos]) return 1;
			}
			return 0;
		};
		BigNum.cmp = function(x, y){
			x = BigNum(x); y = BigNum(y);
			var	x_info = x.get_digit_info(), x_sign = x_info.sign;
			var	y_info = y.get_digit_info(), y_sign = y_info.sign;
			if (x_sign < y_sign) return -1;
			if (y_sign < x_sign) return 1;
			return x_sign * BigNum.cmp_abs(x, y);
		};
		BigNum.neg = function(num){
			num = BigNum(num);
			var	digit_info = num.get_digit_info();
			var	tgt_digit_info = {sign: -1*digit_info.sign, digit_list: digit_info.digit_list.slice(0)};
			return BigNum(tgt_digit_info);
		}
		BigNum.add = function(x, y){
			x = BigNum(x); y = BigNum(y);
			var	x_info = x.get_digit_info();
			var	y_info = y.get_digit_info();
			
			if (!x_info.sign) return BigNum(y_info);
			if (!y_info.sign) return BigNum(x_info);
			
			var	z_info;
			if (BigNum.cmp_abs(x, y)<0) {
				z_info = x_info; x_info = y_info; y_info = z_info;
			}
			return BigNum(add_digit_list(x_info, y_info));
		};
		BigNum.mul = function(x, y){
			x = BigNum(x); y = BigNum(y);
			var	x_info = x.get_digit_info();
			var	y_info = y.get_digit_info();
			
			if (!x_info.sign || !y_info.sign) return BigNum(get_zero_info());
			
			return BigNum(mul_digit_list(x_info, y_info));
		};
		BigNum.sub = function(x, y){
			return BigNum.add(x, BigNum.neg(y));
		};
		BigNum.prototype.toString = function(){
			return this.get_digit_str();
		};
		BigNum.prototype.add = function(n){
			return BigNum.add(this, n);
		};
		BigNum.prototype.sub = function(n){
			return BigNum.sub(this, n);
		};
		BigNum.prototype.mul = function(n){
			return BigNum.mul(this, n);
		};
		BigNum.prototype.cmp = function(n){
			return BigNum.cmp(this,n);
		};
		BigNum.prototype.neg = function(){
			return BigNum.neg(this);
		}
		return BigNum;
	})();	//	end of BigNum()
	
	var	get_date_str = function(time_sec){
		var	dt = new Date(1000 * time_sec);
		return dt.getUTCFullYear() + '-' + (1 + dt.getUTCMonth()) + '-' + dt.getUTCDate();
	};	//	end of get_date_str()
	
	var	get_id_from_utc_sec = function(utc_sec) {
		var	twepoc = ~~(utc_sec) - TWEPOCH;
		return BigNum.mul(ID_INC_PER_SEC, twepoc);
	};	//	end of get_id_from_utc_sec()
	
	var	get_id_range = function(tweet_id, time_sec) {
		var	id_range = null;
		for (;;) {
			if (!ID_BEFORE || !ID_AFTER || (!tweet_id && !time_sec)) break;
			if (!tweet_id) tweet_id = get_id_from_utc_sec(time_sec);
			var	current_id = BigNum(tweet_id);
			var	since_id=current_id.sub(ID_BEFORE), max_id=current_id.add(ID_AFTER);
			log_debug('since_id:'+since_id+' current_id:'+current_id+' max_id:'+max_id);
			if (since_id.cmp(ID_THRESHOLD) < 0) break;
			id_range = {current_id: current_id, since_id: since_id, max_id: max_id}
			break;
		}
		return id_range;
	};	//	end of get_id_range()
	
	var	get_search_url_list = function(tweet_id, screen_name, time_sec, max_id){
		var	search_url_list = [];
		var	query=null;
		if (tweet_id && tweet_id.current_id) {
			var	id_range = tweet_id;
			tweet_id = id_range.current_id;
		}
		else {
			var	id_range = get_id_range(tweet_id, time_sec);
		}
		var	source_hash = tweet_id ? '#source_id='+tweet_id : '';
		if (id_range) {
			var	since_id=id_range.since_id, max_id=id_range.max_id;
			search_url_list.push(API_TIMELINE_BASE + screen_name + '/with_replies?max_id='+max_id+source_hash);
			query = 'from:'+screen_name+' since_id:'+since_id+' max_id:'+max_id;
		}
		if (!query) {
			if (time_sec) {
				var	since = get_date_str(time_sec-3600*24*DAY_BEFORE), until = get_date_str(time_sec+3600*24*(1+DAY_AFTER));
				query = 'from:'+screen_name+' since:'+since+' until:'+until;
			}
			else {
				search_url_list.push(API_TIMELINE_BASE + screen_name + '/with_replies?max_id='+max_id+source_hash);
				query = 'from:'+screen_name+' max_id:'+max_id;
			}
		}
		search_url_list.push(API_SEARCH+'?q='+encodeURIComponent(query)+'&f=realtime'+source_hash);
		return search_url_list;
	};	//	end of get_search_url_list()
	
	var	wopen = function(url, cwin){
		if (cwin) {cwin.location.href = url} else {cwin = w.open(url)}
		return cwin;
	};	//	end of wopen
	
	w[FNAME_ON_CLICK] = function(link, event){
		log_debug('clicked: link.id='+link.id);
		var	onclick = LINK_DICT[link.id];
		if (onclick) onclick(link, event);
		return false;
	};	//	end of _click_link()
	
	var	set_link_to_click = function(jq_link, onclick){
		var	link_id = LINK_ID_PREFIX+(LINK_ID_NUM++);
		jq_link.attr('id', link_id);
		LINK_DICT[link_id] = onclick;
		//jq_link.click(onclick);
		jq_link.attr('onclick', 'javascript:return '+FNAME_ON_CLICK+'(this, window.event||event)');
		//	jq_link.click(onclick) だと、ツイートを「開く」→「閉じる」した後等にonclickがコールされなくなってしまう(Twitter側のスクリプトでイベントを無効化している？)
	};	//	end of set_link_to_click()
	
	var	set_url_list_to_jq_link = function(jq_link, url_search_list){
		var	len = url_search_list.length, ci=0;
		if (len<ci+1) return;
		var	url_search = url_search_list[ci++];
		jq_link.attr('href', url_search);
		if (len<ci+1) return;
		var	url_search_shift = url_search_list[ci++];
		jq_link.attr('alt', url_search_shift);
	};	//	end of set_url_list_to_jq_link()
	
	var	get_jq_link_container = function(url_search_list, class_name, title, text, css){
		var	jq_link_container = $('<small class="'+class_name+'"><a title="'+title+'">'+text+'</a></small>'), jq_link = jq_link_container.find('a:first');
		set_url_list_to_jq_link(jq_link , url_search_list);
		jq_link.css({'font-size':'12px'});
		jq_link.css(css);
		return {container: jq_link_container, link: jq_link};
	};	//	end of get_jq_link_container()
	
	var	get_tweet_li_clone_for_cwin = (function(){
		var	selector_list = [];
		for (var ci=0,len=CONTAINER_CLASS_LIST.length; ci<len; ci++) selector_list[ci] = 'small.'+CONTAINER_CLASS_LIST[ci];
		var	selector = selector_list.join(',');
		return function(jq_tweet_li){
			if (jq_tweet_li[0].tagName != 'LI') jq_tweet_li = jq_tweet_li.parents('li:first');
			var	jq_li_clone = jq_tweet_li.clone(true);
			jq_li_clone.find(selector).each(function(){
				$(this).remove();
				//log_debug('removed: '+this.className);
			});
			return jq_li_clone;
		};
	})();	//	end of get_tweet_li_clone_for_cwin()
	
	var	tweet_search = function(jq_link, event, tweet_id, time_sec, cwin, target_color, jq_tweet_li_target){
		var	url_search = jq_link.attr('href'), url_search_shift = jq_link.attr('alt');
		if (event && event.shiftKey && url_search_shift) url_search = url_search_shift;
		
		log_debug('tweet_search() '+url_search);
		
		if (url_search.indexOf(API_SEARCH, 0) != 0) jq_tweet_li_target = null;
		
		cwin = wopen(url_search, cwin);
		if (!target_color) target_color = TARGET_TWEET_COLOR;
		
		var	wait_cnt = MAX_CHECK_RETRY, last_tweet_id = null, jq_items = null;
		var	giveup_tid = setInterval(function(){
			if (!jq_items) return;
			var	jq_last_tweet = jq_items.find('.js-stream-item[data-item-id]:last');
			var	tmp_tweet_id = (0 < jq_last_tweet.size()) ? jq_last_tweet.attr('data-item-id') : null;
			if (tmp_tweet_id == last_tweet_id) {
				clearInterval(giveup_tid);
				giveup_tid = null;
				return;
			}
			last_tweet_id = tmp_tweet_id;
		}, 1000 * WAIT_BEFORE_GIVEUP_SCROLL_SEC);
		
		var	check = function(){
			var	$ = (function(){try{return cwin.$}catch(e){return null}})();
			if (!$) {
				setTimeout(check, INTV_CHECK_MS);
				return;
			}
			if (!jq_items) {
				jq_items = $([
					'div.GridTimeline-items'
				,	'ol.stream-items'
				].join(','));
				if (jq_items.size()<=0) {
					jq_items = null;
					return;
				}
			}
			if (tweet_id) {
				var	jq_tweet = jq_items.find([
					'div.js-stream-tweet[data-retweet-id="' + tweet_id + '"]:first'
				,	'div.js-stream-tweet[data-item-id="' + tweet_id + '"]:first'
				].join(','));
			}
			else {
				var	jq_tweet = null;
			}
			if (!jq_tweet || jq_tweet.size() < 1) {
				jq_tweet = null;
				jq_items.find('div.js-stream-tweet:not(".'+NAME_SCRIPT+'_touched")[data-item-id]').each(function(){
					var	jq_tmp = $(this);
					jq_tmp.addClass(NAME_SCRIPT+'_touched');
					if (!jq_tweet && !jq_tmp.attr('data-retweet-id')) {
						if (time_sec && parseInt(jq_tmp.find('span[data-time]:first').attr('data-time')) <= time_sec) {
							jq_tweet = jq_tmp;
						}
						else if (tweet_id && BigNum(jq_tmp.attr('data-item-id')).cmp(tweet_id) < 0) {
							jq_tweet = jq_tmp;
						}
					}
				});
				if (!jq_tweet) {
					if (!giveup_tid) {
						log_debug('give up scrolling');
						return;
					}
					var	jq_last_tweet = jq_items.find('.js-stream-item[data-item-id]:last');
					if (0 < jq_last_tweet.size()) {
						$('body,html').animate({scrollTop: jq_last_tweet.offset().top}, '0');
					}
					if ($('div.stream-end').is(':visible')) {
						wait_cnt--;
						if (wait_cnt <= 0) {
							if (jq_tweet_li_target) {
								var	jq_tweet_li_target_clone = get_tweet_li_clone_for_cwin(jq_tweet_li_target);
								try{
									jq_items.find('.js-stream-item[data-item-id]:last').after(jq_tweet_li_target_clone);
									jq_tweet_li_target_clone.css('background-color', target_color);
								}catch(e){}
							}
							return;
						}
					}
					setTimeout(check, INTV_CHECK_MS);
					return;
				}
				target_color = VICINITY_TWEET_COLOR;
				log_debug('pattern-b:'+tweet_id+' '+jq_tweet.attr('data-item-id'));
			}
			else {
				if (jq_tweet.attr('data-retweet-id')==tweet_id) target_color = VICINITY_TWEET_COLOR;
				log_debug('pattern-a:'+tweet_id+' '+jq_tweet.attr('data-item-id'));
			}
			var	jq_tweet_li = (jq_tweet.hasClass('js-stream-item')) ? jq_tweet : jq_tweet.parents('.js-stream-item');
			if (0 < jq_tweet_li.size()) {
				if (jq_tweet_li_target) {
					var	jq_tweet_li_target_clone = get_tweet_li_clone_for_cwin(jq_tweet_li_target);
					try{
						jq_tweet_li.before(jq_tweet_li_target_clone);
						jq_tweet_li = jq_tweet_li_target_clone;
					}catch(e){}
				}
			}
			else {
				jq_tweet_li = jq_tweet;
			}
			var	jq_tweet_li_innter = jq_tweet_li.find('div.js-tweet');
			if (0 < jq_tweet_li_innter.size()) {
				jq_tweet_li_innter.css('background-color', target_color);
			}
			else {
				jq_tweet_li.css('background-color', target_color);
			}
			$('body,html').animate({scrollTop: jq_tweet_li.offset().top - $(cwin).height() / 2}, '0');
			setTimeout(function(){
				$('body,html').animate({scrollTop: jq_tweet_li.offset().top - $(cwin).height() / 2}, '0');
			}, INTV_CHECK_MS);
			return;
		};	//	end of check()
		check();
	};	//	end of tweet_search()
	
	var	add_link_to_tweet = function(jq_tweet){
		//jq_tweet.find('div.proxy-tweet-container small.'+LINK_CONTAINER_CLASS).each(function(){$(this).remove()});
		//if (0 < jq_tweet.parents('div.proxy-tweet-container').size()) return;
		if (!jq_tweet.is(':visible')) return;
		var	jq_container = jq_tweet.find('small.'+LINK_CONTAINER_CLASS);
		if (0<jq_container.size()) return;
		var	tweet_id = jq_tweet.attr('data-item-id'), screen_name = jq_tweet.attr('data-screen-name');
		if (!tweet_id || !screen_name) return;
		
		log_debug('add_link_to_tweet() screen_name:'+screen_name+' tweet_id:'+tweet_id);
		
		var	time_sec = parseInt(jq_tweet.find('span[data-time]:first').attr('data-time'));
		var	url_search_list = get_search_url_list(tweet_id, screen_name, time_sec);
		var	result = get_jq_link_container(url_search_list, LINK_CONTAINER_CLASS, LINK_TITLE, LINK_TEXT, {'color':LINK_COLOR, 'padding':'4px'});
		var	jq_link_container = result.container, jq_link = result.link;
		
		set_link_to_click(jq_link, function(link, event){
			tweet_search(jq_link, event, tweet_id, time_sec);
			return false;
		});
		
		var	jq_insert_point = jq_tweet.find('a.ProfileTweet-timestamp').parent();
		if (jq_insert_point.size()<=0) jq_insert_point = jq_tweet.find('small.time:first');
		jq_insert_point.after(jq_link_container);
		jq_tweet.find('div.client-and-actions span.metadata:first').after(jq_link_container.clone(true));
		
		var	retweet_id = jq_tweet.attr('data-retweet-id'), retweeter = jq_tweet.attr('data-retweeter');
		if (retweet_id && retweeter) {
			var	id_range = get_id_range(retweet_id);
			var	url_rt_search_list = get_search_url_list(id_range, retweeter, null, retweet_id);
			var	result = get_jq_link_container(url_rt_search_list, ACT_CONTAINER_CLASS, ACT_LINK_TITLE, ACT_LINK_TEXT, {'color':ACT_LINK_COLOR, 'padding':'4px'});
			var	jq_rt_link_container = result.container, jq_rt_link = result.link;
			
			var	jq_append_point = jq_tweet.find('div.ProfileTweet-context:first');
			var	flg_enable_insert = (0 < jq_append_point.size()) ? false : true;
			
			if (id_range) {
				set_link_to_click(jq_rt_link, function(link, event){
					tweet_search(jq_rt_link, event, retweet_id, null, null, VICINITY_TWEET_COLOR, flg_enable_insert ? jq_tweet: null);
					return false;
				});
			}
			else {
				set_link_to_click(jq_rt_link, function(link, event){
					var	cwin = wopen('about:blank');
					var	callback = function(html){
						//log_debug('callback');
						for (;;) {
							if (html.match(/<li\s*class="[\s\S]*?stream-item[\s\S]*?data-item-id="(\d+)"/i)) {
								var	tweet_id = RegExp.$1;
								//log_debug('tweet_id='+tweet_id);
								if (html.match(/<span\s*class="[\s\S]*?_timestamp[\s\S]*?\s*data-time="(\d+)"/i)) {
									var	time_sec = parseInt(RegExp.$1);
									//log_debug('time_sec='+time_sec);
									var	url_search_list = get_search_url_list(tweet_id, retweeter, time_sec);
									set_url_list_to_jq_link(jq_rt_link, url_search_list);
									var	click = function(jq_rt_link2, cwin, link, event){
										tweet_search(jq_rt_link2, event, tweet_id, time_sec, cwin, VICINITY_TWEET_COLOR, flg_enable_insert ? jq_tweet: null);
										return false;
									};	//	end of click()
									break;
								}
							}
							var	click = function(jq_rt_link2, cwin, link, event){
								tweet_search(jq_rt_link2, event, retweet_id, null, null, VICINITY_TWEET_COLOR, flg_enable_insert ? jq_tweet: null);
								return false;
							};	//	end of click()
							break;
						}
						var	jq_rt_link2 = jq_rt_link.clone();
						set_link_to_click(jq_rt_link2, function(link, event){
							click(jq_rt_link2, cwin)
						});
						jq_rt_link.after(jq_rt_link2);
						jq_rt_link.remove();
						click(cwin);
						cwin = null;
					};	//	end of callback()
					
					$.get(url_rt_search, callback, 'html');	//$.ajax({url:url_rt_search, success:callback, dataType:'html'});
					
					return false;
				});
			}
			if (jq_append_point.size()<=0) jq_append_point = jq_tweet.find('div.context:first').find('div.with-icn:first');
			jq_append_point.append(jq_rt_link_container);
		}
		
		if (!FLG_TWITSPRITZ || !jq_tweet.parents('div.permalink-tweet-container')[0]) return;
		
		var	result = get_jq_link_container(['javascript:void(0)'], TS_CONTAINER_CLASS, TS_LINK_TITLE, TS_LINK_TEXT, {'color':TS_LINK_COLOR, 'padding':'4px'});
		var	jq_ts_container = result.container, jq_ts_link = result.link;
		
		set_link_to_click(jq_ts_link, function(link, event){
			$.getScript('https://furyu-tei.sakura.ne.jp/ja_spritz/twit_spritz.js', function(){show_spritz()});
			return false;
		});
		jq_link_container.before(jq_ts_container);
		
	};	//	end of add_link_to_tweet()
	
	var	add_link_to_activity = function(jq_activity){
		if (0<jq_activity.find('small.'+ACT_CONTAINER_CLASS).size()) return;
		
		var	jq_timestamp = jq_activity.find('div.activity-timestamp span[data-time]:first');
		if (jq_timestamp.size() < 1) return;
		
		var	jq_tweet = jq_activity.find('div.tweet:first');
		var	tweet_id = (0<jq_tweet.size()) ? jq_tweet.attr('data-item-id') : null;
		
		var	time_sec = parseInt(jq_timestamp.attr('data-time'))
		var	min_sec = parseInt(jq_activity.attr('data-activity-min-position'))/1000, max_sec = parseInt(jq_activity.attr('data-activity-max-position'))/1000;
		
		log_debug('add_link_to_activity() time:'+time_sec+'min:'+min_sec+'max:'+max_sec);
		
		jq_activity.find('ol.activity-supplement a.js-user-tipsy[data-user-id],a.js-action-profile-name').each(function(){
			var	jq_user_link = $(this);
			var	screen_name = jq_user_link.attr('href').replace(/^.*\//,'');
			var	url_search_list = get_search_url_list(null, screen_name, time_sec);
			var	result = get_jq_link_container(url_search_list, ACT_CONTAINER_CLASS, ACT_LINK_TITLE, ACT_LINK_TEXT, {'color':ACT_LINK_COLOR});
			var	jq_link_container = result.container, jq_link = result.link;
			
			set_link_to_click(jq_link, function(link, event){
				tweet_search(jq_link, event, tweet_id, min_sec, null, VICINITY_TWEET_COLOR, jq_activity);
				return false;
			});
			jq_user_link.after(jq_link_container);
		});
		
	};	//	end of add_link_to_activity()
	//} end of functions
	
	
	//{ main procedure
	var	flg_main_called = false;
	var	main_proc = function(){
		if (flg_main_called) return;
		flg_main_called = true;
		
		log_debug('Initializing...');
		
		var	src_tweet_id = (w.location.href.match(/#source_id=(\d+)/)) ? RegExp.$1 : 0;
		var	max_tweet_id = BigNum(src_tweet_id);
		
		if (HIGH_TIME_RESOLUTION) {
			ID_BEFORE = BigNum.mul(ID_INC_PER_SEC, SEC_BEFORE);
			ID_AFTER = BigNum.mul(ID_INC_PER_SEC, SEC_AFTER);
			ID_THRESHOLD = BigNum(ID_THRESHOLD);
			log_debug('ID_INC_PER_SEC='+ID_INC_PER_SEC);
			log_debug('ID_BEFORE='+ID_BEFORE);
			log_debug('ID_AFTER='+ID_AFTER);
			log_debug('ID_THRESHOLD='+ID_THRESHOLD);
		}
		var	container_selector_list = [
			'div.GridTimeline-items'
		,	'ol.stream-items'
		,	'ol.recent-tweets'
		,	'div.permalink-tweet-container'
		];
		var	tweet_selector_list = [];
		for (var ci=0,len=container_selector_list.length; ci<len; ci++) {
			tweet_selector_list.push(container_selector_list[ci] + ' div.tweet');
			tweet_selector_list.push(container_selector_list[ci] + ' div.js-stream-tweet');
		}
		var	tweet_selector = tweet_selector_list.join(',');
		
		$(tweet_selector).each(function(){
			var	jq_tweet = $(this);
			add_link_to_tweet(jq_tweet);
			var	tweet_id = jq_tweet.attr('data-retweet-id') || jq_tweet.attr('data-item-id');
			if (max_tweet_id.cmp(tweet_id) < 0) max_tweet_id = BigNum(tweet_id);
		});
		var	activity_selector = 'div.stream-item-activity-me[data-activity-type]';
		$(activity_selector).each(function(){
			var	jq_activity = $(this);
			add_link_to_activity(jq_activity);
		});
		log_debug('max_tweet_id:'+max_tweet_id);
		
		var	container_selector = container_selector_list.join(',');
		$(d).bind('DOMNodeInserted', function(e){
			var	jq_target = $(e.target);
			((jq_target.hasClass('js-stream-tweet')||jq_target.hasClass('tweet'))?jq_target:jq_target.find('div.js-stream-tweet,div.tweet')).each(function(){
				var	jq_tweet = $(this);
				if (jq_tweet.parents(container_selector).size() <= 0) return;
				add_link_to_tweet(jq_tweet);
				if (!HIDE_NEWER_TWEETS || !src_tweet_id) return;
				//var	jq_container = jq_tweet.parents('div.Grid[data-component-term="tweet"]:first,li.js-stream-item:first');
				var	jq_container = jq_tweet.parents('div.Grid:first,li:first');
				if (jq_container.parent(container_selector).size() <= 0) return;
				var	tweet_id = jq_tweet.attr('data-retweet-id') || jq_tweet.attr('data-item-id');
				if (max_tweet_id.cmp(tweet_id) < 0) {
					jq_tweet.hide();
					jq_container.hide();
					//log_debug('hide: '+jq_tweet.attr('data-item-id'));
				}
			});
			(jq_target.hasClass('stream-item-activity-me')?jq_target:jq_target.find(activity_selector)).each(function(){
				var	jq_activity = $(this);
				add_link_to_activity(jq_activity);
			});
			if (!HIDE_NEWER_TWEETS || !src_tweet_id) return;
			(jq_target.hasClass('js-new-tweets-bar')?jq_target:jq_target.find('div.js-new-tweets-bar')).each(function(){
				var	jq_new_bar = $(this);
				var	jq_container = jq_new_bar.parent('div.stream-item');
				if (jq_container.size() <= 0) return;
				jq_new_bar.hide();
				jq_container.hide();
				//log_debug('hide: new tweets bar');
			});
		});
		
		var	jq_form404 = $('form.search-404');
		if (0 < jq_form404.size()) (function(){
			if (!w.location.href.match(/\/([^/]+)\/status(?:es)?\/(\d+)/)) return;
			var	tweet_id = RegExp.$2, screen_name = RegExp.$1;
			var	url_search_list = get_search_url_list(tweet_id, screen_name);
			var	result = get_jq_link_container(url_search_list, LINK_CONTAINER_CLASS, LINK_TITLE, LINK_TEXT, {'color':LINK_COLOR, 'padding':'4px'});
			var	jq_link_container = result.container, jq_link = result.link;
			set_link_to_click(jq_link, function(link, event){
				//tweet_search(jq_link, event, tweet_id);
				//	※ 404 の window からは子windowにアクセスできない
				//		(Google Chrome)
				//		Uncaught SecurityError: Blocked a frame with origin "https://twitter.com" from accessing a frame with origin "https://twitter.com".
				//		The frame being accessed set "document.domain" to "twitter.com", but the frame requesting access did not. Both must set "document.domain" to the same value to allow access.
				var	url_search = jq_link.attr('href'), url_search_shift = jq_link.attr('alt');
				if (event && event.shiftKey && url_search_shift) url_search = url_search_shift;
				var	cwin=wopen(url_search);
				return false;
			});
			var	jq_h1 = $('h1:first'), h1_html = jq_h1.html(), html_lang=$('html').attr('lang');
			var	check = function(){
				var	jq_h1 = $('h1:first');
				if (jq_h1.html()==h1_html) {
					setTimeout(check, INTV_CHECK_MS);
					return;
				}
				jq_h1.append(jq_link);
			};
			if (html_lang == LANG || !h1_html.match(/sorry/i)) {
				jq_h1.append(jq_link);
			}
			else {
				check();
			}
		})();
		if (src_tweet_id) (function(){
			var	valid_parent = (function(){try{return w.opener.$}catch(e){return null}})();
			if (valid_parent) return;
			//	親windowにアクセスできない(親windowからコントロールできない)場合
			var	jq_link = $('<a/>');
			jq_link.attr('href', w.location.href);
			setTimeout(function(){
				tweet_search(jq_link, null, src_tweet_id, null, w);
			}, INTV_CHECK_MS);
		})();
		log_debug('All set.');
	};	// end of main_proc()
	
	main_proc();
	
	//} end of main procedure
	
}	//	end of main()

if (typeof w.$ == 'function') {
	main(w, d);
}
else {
	var container = d.documentElement;
	var script = d.createElement('script');
	script.textContent = '('+main.toString()+')(window, document);';
	container.appendChild(script);
}

})(window, document);
