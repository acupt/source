function configDoor(config) {
    _doorConfig = config;
    var url = "/ca/img?callback=_afterGetImg";
    _doGet(url);
    var css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = "captcha-dlg.css"; //todo 真实可被外部引用的地址
    document.head.appendChild(css);
}

function _showDoor() {
    document.getElementById("ggdoor_body").style.display = "block";
    // document.getElementById("ggdoor_switch").style.display = "none";
    // _e_dlg.style.height = (_e_bg_img.offsetHeight + 100) + "px";
    _e_body.style.height = (_e_bg_img.offsetHeight + 80) + "px";
    _e_bg_patch.style.height = _e_bg_img.offsetHeight + "px";//设置拼图的高度，宽度为auto，达到和背景图同比例缩放的目的
}

function _hiddenDoor() {
    document.getElementById("ggdoor_body").style.display = "none";
    // document.getElementById("ggdoor_switch").style.display = "block";
}

function _doGet(url, queryMap) {
    if (queryMap) {
        var query = false;
        for (var key in queryMap) {
            if (query) {
                query += "&" + key + "=" + encodeURIComponent(queryMap[key]);
            } else {
                query = "?" + key + "=" + encodeURIComponent(queryMap[key]);
            }
        }
        if (query) {
            url += query;
        }
    }
    url = "//captcha.yidaren.top" + url;
    console.log(url);
    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = url;
    document.head.appendChild(script);
}

function _afterGetImg(res) {
    console.log("获取验证码图片", res);
    if (res.error) {
        alert("获取验证码失败: " + res.msg);
        return;
    }
    // 创建元素
    var e = document.getElementById(_doorConfig.elementId);
    e.style.width = _doorConfig.width;
    e.innerHTML =
        '<div id="ggdoor_dlg" class="ggdoor_dlg">\n' +
        '   <div id="ggdoor_switch" class="ggdoor_switch">点击完成验证</div>\n' +
        '   <div id="ggdoor_body" class="ggdoor_body">\n' +
        '       <div id="ggdoor_main" class="ggdoor_main">\n' +
        '           <div class="ggdoor_bg">\n' +
        '               <img id="ggdoor_bg_img" class="ggdoor_bg_img">\n' +
        '               <img id="ggdoor_bg_patch" class="ggdoor_bg_patch">\n' +
        '           </div>\n' +
        '           <div id="ggdoor_tips" class="ggdoor_tips">\n' +
        '               <div id="ggdoor_slider" class="ggdoor_slider"><span\n' +
        '                                        class="ggdoor_slider_icon"></span>' +
        '               </div>\n' +
        '           </div>\n' +
        '      </div>\n' +
        '   </div>\n' +
        '</div>';
    //
    var width = _doorConfig.width ? _doorConfig.width : "500px";
    width += "";
    if (width.indexOf("px") < 0) {
        width += "px";
    }
    _e_dlg = document.getElementById("ggdoor_dlg");
    _e_switch = document.getElementById("ggdoor_switch");
    _e_body = document.getElementById("ggdoor_body");
    _e_main = document.getElementById("ggdoor_main");
    _e_dlg.style.width = width;
    _e_main.style.width = (_e_dlg.offsetWidth - 20) + "px";
    //
    document.onclick = function () {
        console.log("全局点击");
        if (!isClickDown) {
            _hiddenDoor();
        }
    };
    _e_switch.onclick = function (e) {
        console.log("switch点击");
        _showDoor();
        e.stopPropagation();
    };
    _e_body.onclick = function (e) {
        console.log("body点击");
        e.stopPropagation();
        // return false;
    };

    // 初始化
    _e_bg_img = document.getElementById("ggdoor_bg_img");
    _e_bg_patch = document.getElementById("ggdoor_bg_patch");
    _e_slider = document.getElementById("ggdoor_slider");
    _e_bg_img.src = res.data.bg[0];
    _e_bg_patch.src = res.data.front[0];

    isClickDown = false;
    var track = [];
    var startTs = new Date().getTime();
    var tips = document.getElementById('ggdoor_tips'); //按住可滑动的方块
    var start = function (e) {
        e.stopPropagation();
        isClickDown = true;
        track = [];
    };
    var end = function (e) {
        if (!isClickDown) {
            return;
        }
        if (track.length > 30) {
            var selectItem = [];
            var n = 30;
            while (n-- > 0) {
                var i = Math.floor(Math.random() * track.length);
                selectItem.push(track[i]);
                track.splice(i, 1);
            }
            console.log(track.length + " -> " + selectItem.length);
            track = selectItem;
        }
        var p = _e_bg_patch.style.left;
        if (!p) {
            p = 0;
        } else if (p.indexOf("px") > 0) {
            p = p.substring(0, p.length - 2);
            p = parseInt(p);
        }
        var data = {
            "d": track,
            "p": p
        };
        var queryMap = {
            "data": JSON.stringify(data),
            "callback": "_afterCheck"
        };
        _doGet("/ca/check", queryMap);
    };
    var move = function (e) {
        if (!isClickDown) {
            return;
        }
        var x = e.touches ? e.touches[0].pageX : e.clientX;
        var y = e.touches ? e.touches[0].pageY : e.clientY;
        // console.log(x, y);
        track.push({
            "x": x,
            "y": y,
            "t": new Date().getTime() - startTs
        });
        var lineDiv_left = getPosition(tips).left; //长线条的横坐标
        var minDiv_left = x - lineDiv_left; //小方块相对于父元素（长线条）的left值
        if (minDiv_left >= tips.offsetWidth - _e_slider.offsetWidth) {
            minDiv_left = tips.offsetWidth - _e_slider.offsetWidth;
        }
        if (minDiv_left < 0) {
            minDiv_left = 0;
        }
        //设置拖动后小方块的left值
        _e_slider.style.left = minDiv_left + "px";
        if (minDiv_left >= tips.offsetWidth - _e_bg_patch.offsetWidth) {
            minDiv_left = tips.offsetWidth - _e_bg_patch.offsetWidth;
        }
        _e_bg_patch.style.left = minDiv_left + "px";
    };
    //鼠标按下方块
    _e_slider.addEventListener("touchstart", start);
    _e_slider.addEventListener("mousedown", start);

    //鼠标松开
    window.addEventListener("touchend", end);
    window.addEventListener("mouseup", end);

    //拖动
    window.addEventListener("touchmove", move);
    window.addEventListener("mousemove", move);

    //获取元素的绝对位置
    function getPosition(node) {
        var left = node.offsetLeft; //获取元素相对于其父元素的left值var left
        var top = node.offsetTop;
        current = node.offsetParent; // 取得元素的offsetParent
        // 一直循环直到根元素

        while (current != null) {
            left += current.offsetLeft;
            top += current.offsetTop;
            current = current.offsetParent;
        }
        return {
            "left": left,
            "top": top
        };
    }
}

function _afterCheck(res) {
    isClickDown = false;
    _e_slider.style.left = "0";
    _e_bg_patch.style.left = "0";
    console.log("验证结果", res);
    if (res.error) {
        _doorConfig.onError(res.msg);
    } else if (res.data.result) {
        _doorConfig.onSuccess(res.data.validate);
    } else {
        _doorConfig.onFail();
    }
}