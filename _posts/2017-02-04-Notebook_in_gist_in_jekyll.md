---
layout: post
title: Embedding Jupyter Notebook directly from gist
category: tools
tags:
- Python
- Jupyter
- GitHub
---

Previous options for embedding Jupyter Notebooks in Jekyll were not statisfactory / left some things to be desired. For some time now it has become a lot less cumbersome because [GitHub added advanced support for Jupyter](https://www.programmableweb.com/news/github-launches-advanced-support-jupyter-formerly-ipython/2015/05/07). On a gist you can simply copy the generated html snippet like so:

![Gist embed snippet code]({{site.url}}/images/select_gist_embed.png){: .center-image}

Now you can simply paste this in your jekyll page which will automatically load/render/size everything nicely (or so it seems). Happy times! It would be nice to be able to control the height of the embedded content, but honestly, the gist is one click away.

<!-- more -->

Remember to put the code in raw/endraw tags...

{% highlight html %}
<div class="gist-notebook">
<script src="https://gist.github.com/mvdwoord/5a5ea699a48439a4f26f.js"></script>
</div>
{% endhighlight %}

{% raw %}
<div class="gist-notebook">
<script src="https://gist.github.com/mvdwoord/5a5ea699a48439a4f26f.js"></script>
</div>
{% endraw %}