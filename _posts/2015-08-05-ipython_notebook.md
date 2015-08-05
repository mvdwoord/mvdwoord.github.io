---
layout: post
title: iPython Notebooks in Jekyll
category: tools
tags: 
- Python
- notebook
---
My solution for integrating an iPython notebook in Jekyll. It uses an iframe around an [nbviewer](http://nbviewer.ipython.org/) page referring to a github gist.

The CSS to make the iframe resize nicely was stolen from [Michael Lancaster](http://www.bymichaellancaster.com/blog/fluid-iframe-and-images-without-javascript-plugins/) and I add an inline style in the outer div tag to set the height. It would be nice to have that automatically, but as far as I can tell that's not possible without some javascript voodoo I prefer to avoid.

<!-- more -->

The workflow thus becomes:

- Save iPython notebook as .ipynb
- Copy contents into a Github gist
- Add iframe with nbviewer page to jekyll post
- ...
- Profit!

{% highlight html %}
<div class="fluidMedia" style="height: 1500px;">
    <iframe src="http://nbviewer.ipython.org/gist/mvdwoord/5a5ea699a48439a4f26f" frameborder="0" > </iframe>
</div>
{% endhighlight %}

<div class="fluidMedia" style="height: 1500px;">
    <iframe src="http://nbviewer.ipython.org/gist/mvdwoord/5a5ea699a48439a4f26f" frameborder="0" > </iframe>
</div>