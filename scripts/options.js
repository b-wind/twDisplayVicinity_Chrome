( function( w, d ) {

$( function () {
    var RADIO_KV_LIST = [
            { key : 'USE_SEARCH_TL_BY_DEFAULT', val : false }
        ,   { key : 'USE_LINK_ICON', val : true }
        ],
        INT_KV_LIST = [
            { key : 'HOUR_AFTER', val : 8, min : 0, max : null }
        ],
        STR_KV_LIST = [
            { key : 'LINK_TEXT' }
        ,   { key : 'ACT_LINK_TEXT' }
        ];
    
    STR_KV_LIST.forEach( function( str_kv ) {
        str_kv.val = chrome.i18n.getMessage( str_kv.key );
    } );
    
    $( '.i18n' ).each( function () {
        var jq_elm = $( this ),
            text = chrome.i18n.getMessage( ( jq_elm.val() ) || ( jq_elm.html() ) );
        
        if ( ! text ) {
            return;
        }
        if ( jq_elm.val() ) {
            jq_elm.val( text );
        }
        else {
            jq_elm.html( text );
        }
    } );
    
    $( 'form' ).submit( function () {
        return false;
    } );
    
    
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
    
    
    function set_radio_evt( kv ) {
        function check_svalue( kv, svalue ) {
            var bool_value = get_bool( svalue );
            
            if ( bool_value === null ) {
                return check_svalue( kv, kv.val );
            }
            return ( bool_value ) ? '1' : '0';
        }
        
        var key = kv.key,
            svalue = check_svalue( kv, localStorage[ key ] ),
            jq_target = $( '#' + key ),
            jq_inputs = jq_target.find( 'input:radio' );
        
        jq_inputs.each( function () {
            var jq_input = $( this ),
                val=jq_input.val();
            
            if ( val === svalue ) {
                jq_input.attr( 'checked', 'checked' );
            }
        } );
        
        jq_inputs.unbind( 'change' ).change( function () {
            var jq_input = $( this );
            
            localStorage[ key ] = check_svalue( kv, jq_input.val() );
        } );
    } // end of set_radio_evt()
    
    
    function set_int_evt( kv ) {
        function check_svalue( kv, svalue ) {
            if ( isNaN( svalue ) ) {
                svalue = kv.val;
            }
            else {
                svalue = parseInt( svalue );
                if ( ( ( kv.min !== null ) && ( svalue < kv.min ) ) || ( ( kv.max !== null ) && ( kv.max < svalue ) ) ) {
                    svalue = kv.val;
                }
            }
            svalue = String( svalue );
            return svalue;
        }
        
        var key = kv.key,
            svalue = check_svalue( kv, localStorage[ key ] ),
            jq_target = $( '#' + key ),
            jq_input = jq_target.find( 'input:text:first' ),
            jq_current = jq_target.find( 'span.current:first' );
        
        jq_current.text( svalue );
        jq_input.val( svalue );
        
        jq_target.find( 'input:button' ).unbind( 'click' ).click( function () {
            var svalue = check_svalue( kv, jq_input.val() );
            
            localStorage[ key ] = svalue;
            jq_current.text( svalue );
            jq_input.val( svalue );
        } );
    } // end of set_int_evt()
    
    
    function set_str_evt( kv ) {
        function check_svalue( kv, svalue ) {
            if ( ! svalue ) {
                svalue = kv.val;
            }
            else {
                svalue = String( svalue ).replace( /(?:^\s+|\s+$)/g, '' );
                if ( ! svalue ) {
                    svalue = kv.val;
                }
            }
            return svalue;
        }
        
        var key = kv.key,
            svalue = check_svalue( kv, localStorage[ key ] ),
            jq_target = $( '#' + key ),
            jq_input = jq_target.find( 'input:text:first' ),
            jq_current = jq_target.find( 'span.current:first' );
        
        jq_current.text( svalue );
        jq_input.val( svalue );
        
        jq_target.find( 'input:button' ).unbind( 'click' ).click( function () {
            var svalue = check_svalue( kv, jq_input.val() );
            
            localStorage[ key ] = svalue;
            jq_current.text( svalue );
            jq_input.val( svalue );
        } );
    } // end of set_str_evt()
    
    
    function set_all_evt() {
        RADIO_KV_LIST.forEach( function( radio_kv ) {
            set_radio_evt( radio_kv );
        } );
        
        INT_KV_LIST.forEach( function( int_kv ) {
            set_int_evt( int_kv );
        } );
        
        STR_KV_LIST.forEach( function( str_kv ) {
            set_str_evt( str_kv );
        } );
    }   //  end of set_all_evt()
    
    
    set_all_evt();
    
    
    $( 'input[name="DEFAULT"]' ).click( function () {
        localStorage.clear();
        set_all_evt();
    } );

} );

} )( window, document );

// ■ end of file
