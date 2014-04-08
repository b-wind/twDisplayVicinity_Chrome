// ==UserScript==
// @name           twDisplayVicinity
// @namespace      http://d.hatena.ne.jp/furyu-tei
// @include        http://twitter.com/*
// @include        https://twitter.com/*
// @description    display the vicinity of a particular tweet on Twitter ver.0.01c
// ==/UserScript==
/*
  Download URL: 'http://furyu-tei.sakura.ne.jp/script/twDisplayVicinity.user.js'
  see also http://let.hatelabo.jp/furyu-tei/let/hLHVnMG9q-NH
*/
(function(w, d){
var main = function(w, d){
	//{ user parameters
	//var DEBUG = true;
	var DEBUG = false;
	
	var	DAY_BEFORE = 1;
	var	DAY_AFTER = 1;
	
	//var	HIGH_TIME_RESOLUTION = false;
	var	HIGH_TIME_RESOLUTION = true;
	var	HOUR_BEFORE = 24;	//	enabled if HIGH_TIME_RESOLUTION is true
	var	HOUR_AFTER = 8;		//	enabled if HIGH_TIME_RESOLUTION is true
	var	USE_BIGINT_JS = false;	//	true: use 'bigint.js' false: use inner class
	
	var	TARGET_TWEET_COLOR = 'gold';
	var	VICINITY_TWEET_COLOR = 'pink';
	
	var	LINK_COLOR = 'darkblue';
	var	LINK_TEXT = '\u8fd1\u508d';	//	"近傍"
	var	LINK_TITLE = '\u8fd1\u508d\u30c4\u30a4\u30fc\u30c8\u8868\u793a';	//	"近傍ツイート表示"
	
	var	ACT_LINK_COLOR = 'indigo';
	var	ACT_LINK_TEXT = '\u8fd1\u508d';	//	"近傍"
	var	ACT_LINK_TITLE = '\u30a2\u30af\u30b7\u30e7\u30f3\u306e\u8fd1\u508d\u30c4\u30a4\u30fc\u30c8\u8868\u793a';	//	"アクションの近傍ツイート表示"
	
	var	FLG_TWITSPRITZ = true;
	var	TS_LINK_COLOR = 'darkgreen';
	var	TS_LINK_TEXT = 'TwitSpritz';
	var	TS_LINK_TITLE = 'TwitSpritz\x3a\x20Spritz\u3082\u3069\u304d\u8868\u793a';	//	"TwitSpritz: Spritzもどき表示"
	
	//} end of user parameters
	
	
	//{ global variables
	var NAME_SCRIPT = 'twDisplayVicinity';
	var VER_SCRIPT = '0.01';
	var $=w.$;
	
	//{ check environment
	if (w[NAME_SCRIPT+'_touched']) return;
	if (!$) {var main = arguments.callee; setTimeout(function(){main(w,d);}, 100); return;}
	w[NAME_SCRIPT+'_touched'] = true;
	//} end of check environment
	
	var	API_SEARCH = 'https://twitter.com/search';
	var	FNAME_ON_CLICK = NAME_SCRIPT+'_click_link';
	var	LINK_ID_PREFIX = NAME_SCRIPT+'_link_';
	
	var	LINK_CONTAINER_CLASS = NAME_SCRIPT+'_link_container';
	var	ACT_CONTAINER_CLASS = NAME_SCRIPT+'_act_container';
	var	TS_CONTAINER_CLASS = NAME_SCRIPT+'_ts_container';
	
	var	CONTAINER_CLASS_LIST = [LINK_CONTAINER_CLASS, ACT_CONTAINER_CLASS, TS_CONTAINER_CLASS];
	
	var	LINK_DICT = {};
	var	LINK_ID_NUM = 1;
	
	var	INTV_CHECK = 300;	// ms
	var	MAX_RETRY = 3;
	
	//	[bigint.js] http://blog.livedoor.jp/dankogai/archives/51516961.html
	var	BIGINT_JS_WAIT_SEC = 3;
	var	URL_BIGINT_JS = 'https://furyu-tei.sakura.ne.jp/script/bigint.js';
	//var	URL_BIGINT_JS = 'https://raw.githubusercontent.com/dankogai/js-math-bigint/master/bigint.js';
	
	var	ID_INC_PER_SEC = 1000*(0x01 << 22);
	var	SEC_BEFORE = HOUR_BEFORE * 3600;
	var	SEC_AFTER = HOUR_AFTER * 3600;
	var	TWEPOCH = 1288834974657;
	var	ID_BEFORE = null;
	var	ID_AFTER = null;
	var	ID_THRESHOLD = null;
	
	//} end of global variables
	
	
	//{ functions
	var log_debug = (function(){
		if (DEBUG) {
			var jq_log_container = $('<textarea id="'+NAME_SCRIPT+'_log" style="width:100%; height:100px; background:lightblue; text-align:left; overflow-y:scroll" readonly></textarea>')
			$('div.global-nav').append(jq_log_container);
			$('div.global-nav').css('height', '140px');
		}
		return function(str){
			if (!DEBUG) return;
			jq_log_container.html(jq_log_container.html()+NAME_SCRIPT+' ['+new Date().toISOString()+'] '+str+'\n');
			jq_log_container.scrollTop(jq_log_container.prop('scrollHeight'));
		};
	})();	//	end of log_debug()
	
	var	BigNum = (function(){
		var	DIGIT_UNIT_LEN = 15;
		var	DIV_UNIT = Math.pow(10, DIGIT_UNIT_LEN);
		
		var	re_digit = /^\s*([+\-]?)0*(\d+)\s*$/;
		var	re_zerosup = /^0*(\d+)$/;
		var	get_zero_info = function(){return {sign: 0, digit_list: [0]}};
		var	zero_str = Array(DIGIT_UNIT_LEN).join('0');
		var	zero_pad = function(num, len){
			if (!len) len = DIGIT_UNIT_LEN;
			if (num.length == len) return num;
			if (len == DIGIT_UNIT_LEN) return (zero_str+num).slice(-len);
			return (Array(len).join('0')+num).slice(-len);
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
			//for (var pos = digit_list.length-1; 0<=pos; pos--) digit_str_list.push(zero_pad(digit_list[pos]));
			//return ((sign<0) ? '-' : '')+digit_str_list.join('').replace(re_zerosup, '$1');
			var	pos = digit_list.length-1;
			digit_str_list.push(digit_list[pos--]);
			for (; 0<=pos; pos--) digit_str_list.push(zero_pad(digit_list[pos]));
			return ((sign<0) ? '-' : '')+digit_str_list.join('');
		};
		var	add_digit_list = function(x_info, y_info){
			var	x_sign = x_info.sign, x_digit_list = x_info.digit_list;
			var	y_sign = y_info.sign, y_digit_list = y_info.digit_list;
			var	z_sign = 0, z_digit_list = [];
			var	cx=0, cy=0, cz=0, cs=0;
			for (var pos=0, xlen=x_digit_list.length, ylen=y_digit_list.length, len=Math.max(xlen, ylen); pos<len; pos++) {
				cx = (pos<xlen) ? x_digit_list[pos] : 0;
				cy = (pos<ylen) ? y_digit_list[pos] : 0;
				cx = x_sign*cx; cy = y_sign*cy;
				cz = cx+cy+cz;
				cs = (x_sign*cz<0) ? x_sign*DIV_UNIT : 0;
				cz += cs;
				if (cz) z_sign = cz<0 ? -1 : 1;
				//log_debug('cx='+cx+' cy='+cy+' cz='+cz+' cs='+cs);
				z_digit_list.push(z_sign*(cz%DIV_UNIT));
				cz = ~~(cz/DIV_UNIT)-~~(cs/DIV_UNIT);
			}
			if (1<=Math.abs(cz)) z_digit_list.push(cz);
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
				digit_str = null;
			};
			self.get_digit_info = function(){return digit_info};
			self.set_digit_info = function(_digit_info){
				digit_info = _digit_info;
				//digit_info = {sign: _digit_info.sign, digit_list: _digit_info.digit_list};
				digit_str = null;
				num = null;
			};
			self.get_digit_str = function(){
				if (!digit_str) digit_str = get_digit_str(digit_info.sign, digit_info.digit_list);
				if (!num) num = digit_str;
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
			digit_info.sign *= -1;
			return BigNum(digit_info);
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
	
	var	get_search_query = function(tweet_id, screen_name, time_sec) {
		if (HIGH_TIME_RESOLUTION && ID_THRESHOLD && tweet_id) {
			var	current_id = (USE_BIGINT_JS) ? bigint(tweet_id) : BigNum(tweet_id);
			if (ID_THRESHOLD.cmp(current_id)<0) {
				var	since_id=current_id.sub(ID_BEFORE), max_id=current_id.add(ID_AFTER);
				log_debug('since_id:'+since_id+' current_id:'+current_id+' max_id:'+max_id);
				return 'from:'+screen_name+' since_id:'+since_id+' max_id:'+max_id;
			}
		}
		var	since = get_date_str(time_sec-3600*24*DAY_BEFORE), until = get_date_str(time_sec+3600*24*(1+DAY_AFTER));
		return 'from:'+screen_name+' since:'+since+' until:'+until;
	};	//	end of get_search_query()
	
	var	wopen = function(url, cwin){
		if (cwin) {cwin.location.href = url} else {cwin = w.open(url)}
		return cwin;
	};	//	end of wopen
	
	var	get_search_url = function(query){
		return API_SEARCH+'?q='+encodeURIComponent(query)+'&f=realtime';
	};	//	end of get_search_url()
	
	w[FNAME_ON_CLICK] = function(link){
		log_debug('clicked: link.id='+link.id);
		var	onclick = LINK_DICT[link.id];
		if (onclick) onclick();
		return false;
	};	//	end of _click_link()
	
	var	set_link_to_click = function(jq_link, onclick){
		var	link_id = LINK_ID_PREFIX+(LINK_ID_NUM++);
		jq_link.attr('id', link_id);
		LINK_DICT[link_id] = onclick;
		//jq_link.click(onclick);
		jq_link.attr('onclick', 'javascript:return '+FNAME_ON_CLICK+'(this)');
		//	jq_link.click(onclick) だと、ツイートを「開く」→「閉じる」した後等にonclickがコールされなくなってしまう(Twitter側のスクリプトでイベントを無効化している？)
	};	//	end of set_link_to_click()
	
	var	get_tweet_li_clone_for_cwin = (function(){
		var	selector_list = [];
		for (var ci=0,len=CONTAINER_CLASS_LIST.length; ci<len; ci++) selector_list[ci] = 'small.'+CONTAINER_CLASS_LIST[ci];
		var	selector = selector_list.join(',');
		return function(jq_tweet_li){
			if (jq_tweet_li[0].tagName != 'LI') jq_tweet_li = jq_tweet_li.parents('li:first');
			var	jq_li_clone = jq_tweet_li.clone(true);
			jq_li_clone.find(selector).each(function(){
				$(this).remove();
				log_debug('removed: '+this.className);
			});
			return jq_li_clone;
		};
	})();	//	end of get_tweet_li_clone_for_cwin()
	
	var	add_link_to_tweet = function(jq_tweet){
		if (0<jq_tweet.find('small.'+LINK_CONTAINER_CLASS).size()) return;
		var	tweet_id = jq_tweet.attr('data-item-id'), screen_name = jq_tweet.attr('data-screen-name');
		if (!tweet_id || !screen_name) return;
		var	time_sec = parseInt(jq_tweet.find('span[data-time]:first').attr('data-time'));
		//var	since = get_date_str(time_sec-3600*24*DAY_BEFORE), until = get_date_str(time_sec+3600*24*(1+DAY_AFTER));
		//var	url_search = get_search_url('from:'+screen_name+' since:'+since+' until:'+until);
		var	url_search = get_search_url(get_search_query(tweet_id, screen_name, time_sec));
		
		var	jq_link_container = $('<small class="'+LINK_CONTAINER_CLASS+'"><a title="'+LINK_TITLE+'">'+LINK_TEXT+'</a></small>'), jq_link = jq_link_container.find('a:first');
		jq_link.attr('href', url_search);
		jq_link.css({'color':LINK_COLOR, 'padding':'4px'});
		
		var	tweet_search_by_id = function(url_search, tweet_id, time_sec, cwin, target_color, jq_tweet_li_target){
			cwin = wopen(url_search, cwin);
			if (!target_color) target_color = TARGET_TWEET_COLOR;
			var	wait_cnt = MAX_RETRY;
			var	check = function(){
				var	$ = (function(){try{return cwin.$}catch(e){return null}})();
				if (!$) {
					setTimeout(check, INTV_CHECK);
					return;
				}
				var	jq_tweet_li = $('li[data-item-id="' + tweet_id + '"]:first');
				if (jq_tweet_li.size() < 1) {
					var	jq_tweet_li = null;
					$('li:not(".'+NAME_SCRIPT+'_touched")[data-item-id]').each(function(){
						var	jq_li = $(this);
						jq_li.addClass(NAME_SCRIPT+'_touched');
						var	tmp_time_sec = parseInt(jq_li.find('div.tweet span[data-time]:first').attr('data-time'));
						if (!jq_tweet_li && tmp_time_sec <= time_sec) jq_tweet_li = jq_li;
					});
					if (!jq_tweet_li) {
						$('body,html').animate({scrollTop: $('li[data-item-id]:last').offset().top}, '0');
						if ($('div.stream-end').is(':visible')) {
							wait_cnt--;
							if (wait_cnt <= 0) {
								if (!jq_tweet_li_target) return;
								var	jq_tweet_li_target_clone = get_tweet_li_clone_for_cwin(jq_tweet_li_target);
								try{
									$('li[data-item-id]:last').after(jq_tweet_li_target_clone);
									jq_tweet_li_target_clone.css('background', target_color);
								}catch(e){}
								return;
							}
						}
						setTimeout(check, INTV_CHECK);
						return;
					}
					target_color = VICINITY_TWEET_COLOR;
				} 
				if (jq_tweet_li_target) {
					var	jq_tweet_li_target_clone = get_tweet_li_clone_for_cwin(jq_tweet_li_target);
					try{
						jq_tweet_li.before(jq_tweet_li_target_clone);
						jq_tweet_li = jq_tweet_li_target_clone;
					}catch(e){}
				}
				jq_tweet_li.css('background', target_color);
				$('body,html').animate({scrollTop: jq_tweet_li.offset().top - $(cwin).height() / 2}, '0');
			};	//	end of check()
			check();
		};	//	end of tweet_search_by_id()
		
		set_link_to_click(jq_link, function(){
			tweet_search_by_id(url_search, tweet_id, time_sec);
			return false;
		});
		
		jq_tweet.find('small.time:first').after(jq_link_container);
		jq_tweet.find('div.client-and-actions span.metadata:first').after(jq_link_container.clone(true));
		
		var	retweet_id = jq_tweet.attr('data-retweet-id'), retweeter = jq_tweet.attr('data-retweeter');
		if (retweet_id && retweeter) {
			var	url_rt_search = get_search_url('from:'+retweeter+' max_id:'+retweet_id);
			
			var	jq_rt_link_container = $('<small class="'+ACT_CONTAINER_CLASS+'"><a title="'+ACT_LINK_TITLE+'">'+ACT_LINK_TEXT+'</a></small>'), jq_rt_link = jq_rt_link_container.find('a:first');
			jq_rt_link.attr('href', url_rt_search);
			jq_rt_link.css({'color':ACT_LINK_COLOR, 'padding':'4px'});
			
			set_link_to_click(jq_rt_link, function(){
				var	cwin = wopen('about:blank');
				var	callback = function(html){
					log_debug('callback');
					for (;;) {
						if (html.match(/<li\s*class="[\s\S]*?stream-item[\s\S]*?data-item-id="(\d+)"/i)) {
							var	tweet_id = RegExp.$1;
							log_debug('tweet_id='+tweet_id);
							if (html.match(/<span\s*class="[\s\S]*?_timestamp[\s\S]*?\s*data-time="(\d+)"/i)) {
								var	time_sec = parseInt(RegExp.$1);
								log_debug('time_sec='+time_sec);
								//var	since = get_date_str(time_sec-3600*24*DAY_BEFORE), until = get_date_str(time_sec+3600*24*(1+DAY_AFTER));
								//var	url_search = get_search_url('from:'+retweeter+' since:'+since+' until:'+until);
								var	url_search = get_search_url(get_search_query(tweet_id, retweeter, time_sec));
								jq_rt_link.attr('href', url_search);
								var	click = function(cwin){
									tweet_search_by_id(url_search, tweet_id, time_sec, cwin, VICINITY_TWEET_COLOR, jq_tweet);
									return false;
								};	//	end of click()
								break;
							}
						}
						var	click = function(cwin){
							var	wait_cnt = MAX_RETRY;
							cwin = wopen(url_rt_search, cwin);
							var	check = function(){
								var	$ = (function(){try{return cwin.$}catch(e){return null}})();
								if (!$) {
									setTimeout(check, INTV_CHECK);
									return;
								}
								var	jq_tweet_li = $("li[data-item-id]:first");
								if (jq_tweet_li.size() < 1) {
									if ($('div.stream-end').is(':visible')) {
										wait_cnt--;
										if (wait_cnt <= 0) return;
									}
									setTimeout(check, INTV_CHECK);
									return;
								} 
								var	jq_tweet_li_target_clone = get_tweet_li_clone_for_cwin(jq_tweet);
								try{
									jq_tweet_li.before(jq_tweet_li_target_clone);
									jq_tweet_li = jq_tweet_li_target_clone;
								}catch(e){}
								jq_tweet_li.css('background', VICINITY_TWEET_COLOR);
							};	//	end of check()
							check();
							return false;
						};	//	end of click()
						break;
					}
					var	jq_rt_link2 = jq_rt_link.clone();
					set_link_to_click(jq_rt_link2, function(){click(cwin)});
					jq_rt_link.after(jq_rt_link2);
					jq_rt_link.remove();
					//jq_rt_link2.click();
					click(cwin);
					cwin = null;
				};	//	end of callback()
				
				//$.ajax({url:url_rt_search, success:callback, dataType:'html'});
				$.get(url_rt_search, callback, 'html');
				
				return false;
			});
			jq_tweet.find('div.context:first').find('div.with-icn:first').append(jq_rt_link_container);
		}
		
		if (!FLG_TWITSPRITZ || !jq_tweet.parents('div.permalink-tweet-container')[0]) return;
		
		var	jq_ts_container = $('<small class="'+TS_CONTAINER_CLASS+'"><a title="'+TS_LINK_TITLE+'">'+TS_LINK_TEXT+'</a></small>'), jq_ts_link = jq_ts_container.find('a:first');
		jq_ts_link.css({'color':TS_LINK_COLOR, 'padding':'4px'});
		
		set_link_to_click(jq_ts_link, function(){
			$.getScript('https://furyu-tei.sakura.ne.jp/ja_spritz/twit_spritz.js', function(){show_spritz()});
			return false;
		});
		jq_link_container.before(jq_ts_container);
		
	};	//	end of add_link_to_tweet()
	
	var	add_link_to_activity = function(jq_activity){
		if (0<jq_activity.find('small.'+ACT_CONTAINER_CLASS).size()) return;
		var	jq_timestamp = jq_activity.find('div.activity-timestamp span[data-time]:first');
		if (jq_timestamp.size() < 1) return;
		var	time_sec = parseInt(jq_timestamp.attr('data-time'))
		//var	since = get_date_str(time_sec-3600*24*DAY_BEFORE), until = get_date_str(time_sec+3600*24*(1+DAY_AFTER));
		var	min_sec = parseInt(jq_activity.attr('data-activity-min-position'))/1000, max_sec = parseInt(jq_activity.attr('data-activity-max-position'))/1000;
		
		log_debug('add_link_to_activity() time:'+time_sec+'min:'+min_sec+'max:'+max_sec);
		
		jq_activity.find('ol.activity-supplement a.js-user-tipsy[data-user-id],a.js-action-profile-name').each(function(){
			var	jq_user_link = $(this);
			var	screen_name = jq_user_link.attr('href').replace(/^.*\//,'');
			//var	url_search = get_search_url('from:'+screen_name+' since:'+since+' until:'+until);
			var	url_search = get_search_url(get_search_query(null, screen_name, time_sec));
			
			var	jq_link_container = $('<small class="'+ACT_CONTAINER_CLASS+'"><a title="'+ACT_LINK_TITLE+'">'+ACT_LINK_TEXT+'</a></small>'), jq_link = jq_link_container.find('a:first');
			jq_link.attr('href', url_search);
			jq_link.css({'color':ACT_LINK_COLOR});
			
			set_link_to_click(jq_link, function(){
				var	wait_cnt = MAX_RETRY;
				var	cwin = wopen(url_search);
				var	check = function(){
					var	$ = (function(){try{return cwin.$}catch(e){return null}})();
					if (!$) {
						setTimeout(check, INTV_CHECK);
						return;
					}
					var	jq_activity_li=null;
					$('li:not(".'+NAME_SCRIPT+'_touched")[data-item-id]').each(function(){
						var	jq_li = $(this);
						jq_li.addClass(NAME_SCRIPT+'_touched');
						var	tmp_time_sec = parseInt(jq_li.find('div.tweet span[data-time]:first').attr('data-time'));
						if (!jq_activity_li && tmp_time_sec <= min_sec) jq_activity_li = jq_li;
					});
					if (!jq_activity_li) {
						$('body,html').animate({scrollTop: $('li[data-item-id]:last').offset().top}, '0');
						if ($('div.stream-end').is(':visible')) {
							wait_cnt--;
							if (wait_cnt <= 0) {
								var	jq_activity_li_target_clone = get_tweet_li_clone_for_cwin(jq_activity);
								try{
									$('li[data-item-id]:last').after(jq_activity_li_target_clone);
									jq_activity_li_target_clone.css('background', VICINITY_TWEET_COLOR);
								}catch(e){}
								return;
							}
						}
						setTimeout(check, INTV_CHECK);
						return;
					}
					var	jq_activity_li_target_clone = get_tweet_li_clone_for_cwin(jq_activity);
					try{
						jq_activity_li.before(jq_activity_li_target_clone);
						jq_activity_li = jq_activity_li_target_clone;
					}catch(e){}
					jq_activity_li.css('background', VICINITY_TWEET_COLOR);
					$('body,html').animate({scrollTop: jq_activity_li.offset().top - $(cwin).height() / 2}, '0');
				};	//	end of check()
				check();
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
		
		if (!ID_THRESHOLD) {
			// T.B.D.: multiplication is not supported by inner class ...
			ID_BEFORE = ID_INC_PER_SEC * SEC_BEFORE;
			ID_AFTER = ID_INC_PER_SEC * SEC_AFTER;
			ID_THRESHOLD = BigNum.add('300000000000000', ID_BEFORE);
			log_debug('ID_INC_PER_SEC='+ID_INC_PER_SEC);
			log_debug('ID_BEFORE='+ID_BEFORE);
			log_debug('ID_AFTER='+ID_AFTER);
			log_debug('ID_THRESHOLD='+ID_THRESHOLD);
		}
		var	container_selector_list = [
			'ol.stream-items'
		,	'ol.recent-tweets'
		,	'div.permalink-tweet-container'
		];
		var	tweet_selector_list = [];
		for (var ci=0,len=container_selector_list.length; ci<len; ci++) tweet_selector_list[ci] = container_selector_list[ci] + ' div.tweet';
		var	tweet_selector = tweet_selector_list.join(',');
		
		$(tweet_selector).each(function(){
			add_link_to_tweet($(this));
		});
		/*
		//var	activity_type_list = [
		//	'retweet', 'favorite', 'follow', 'retweeted_mention', 'favorited_mention', 'retweeted_retweet_activity'
		//];
		//var	activity_selector_list = [];
		//for (var ci=0,len=activity_type_list.length; ci<len; ci++) activity_selector_list[ci] = 'div.stream-item-activity-me[data-activity-type="'+activity_type_list[ci]+'"]';
		//var	activity_selector = activity_selector_list.join(',');
		*/
		var	activity_selector = 'div.stream-item-activity-me[data-activity-type]';
		$(activity_selector).each(function(){
			add_link_to_activity($(this));
		});
		
		/*
		//$(d).on('DOMNodeInserted', tweet_selector, function(){
		//	log_debug($(this).attr('class').replace(/\s+/g,' '));
		//	add_link_to_tweet($(this));
		//});
		*/
		$(d).bind('DOMNodeInserted', function(e){
			var	jq_target = $(e.target);
			(jq_target.hasClass('tweet')?jq_target:jq_target.find('div.tweet')).each(function(){
				add_link_to_tweet($(this));
			});
			(jq_target.hasClass('stream-item-activity-me')?jq_target:jq_target.find(activity_selector)).each(function(){
				add_link_to_activity($(this));
			});
		});
		
		$('body,html').on('mouseover', tweet_selector, function(){
			add_link_to_tweet($(this));
		});
		
		log_debug('All set.');
	};	// end of main_proc()
	
	
	if (USE_BIGINT_JS) {
		w.bigint = null;
		var	tid = setTimeout(function(){
			clr_tid();
			log_debug('load timeout: '+URL_BIGINT_JS);
			main_proc();
		}, 1000*BIGINT_JS_WAIT_SEC);
		
		var	clr_tid = function(){
			if (!tid) return;
			clearTimeout(tid);
			tid = null;
		};	//	end of clr_tid();
		
		$.ajax({
			type: "GET"
		,	url: URL_BIGINT_JS
		,	dataType: 'script'
		,	success: function(){
				if (typeof bigint == 'function') {
					var	id_inc_per_sec = bigint(ID_INC_PER_SEC);
					ID_BEFORE = id_inc_per_sec.mul(SEC_BEFORE);
					ID_AFTER = id_inc_per_sec.mul(SEC_AFTER);
					ID_THRESHOLD = bigint('300000000000000').add(ID_BEFORE);
					log_debug('ID_INC_PER_SEC='+id_inc_per_sec);
					log_debug('ID_BEFORE='+ID_BEFORE);
					log_debug('ID_AFTER='+ID_AFTER);
					log_debug('ID_THRESHOLD='+ID_THRESHOLD);
					log_debug('ready to use bigint()');
				}
				clr_tid();
				main_proc();
			}
		,	error: function (xhr, status, error) {	//	error event does not fire on cross domain
				log_debug('load error: '+URL_BIGINT_JS+' status='+status+' '+error);
				clr_tid();
				main_proc();
			}
		,	cache: true
		});
	}
	else {
		main_proc();
	}
	
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
