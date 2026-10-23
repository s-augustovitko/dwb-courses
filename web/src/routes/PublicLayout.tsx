import type { ParentComponent } from "solid-js";
import { ErrorLoadingWrapper } from "~/components/layout";
import { COPYRIGHT } from "~/utils";

const PublicLayout: ParentComponent = (props) => (
  <section class="hero is-fullheight has-background-white-bis">
    <div class="hero-body is-align-items-flex-start">
      <div class="container is-max-tablet">
        <div class="box">
          <figure class="image mb-5">
            <img
              src="/dwb-header.webp"
              alt="Budismo Camino del Diamante Perú"
            />
          </figure>

          <ErrorLoadingWrapper>{props.children}</ErrorLoadingWrapper>
        </div>

        <p class="has-text-centered has-text-grey is-size-7">{COPYRIGHT}</p>
      </div>
    </div>
  </section>
);

export default PublicLayout;
